-- recurring_bills: bills that come back every month, quarter or year
-- (mvp-brief.md data model; Week 4, task 4a-1). Decisions: plan review 3.6,
-- 3.7, and the Week 4 plan (owner, Nov 24): `first_due_month` for quarterly
-- and yearly bills, and `every` as the pay slot on one-payday budgets.

-- ---------------------------------------------------------------------------
-- The table
-- ---------------------------------------------------------------------------
create table public.recurring_bills (
  id uuid primary key default gen_random_uuid(),
  -- Filled in from the logged-in user, so the app never sends it.
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  budget_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  -- Centavos, above zero. With amount_varies on, it's the typical amount used
  -- for planning (like income sources).
  amount bigint not null check (amount > 0),
  amount_varies boolean not null default false,
  category_id uuid not null,
  frequency text not null check (frequency in ('monthly', 'quarterly', 'yearly')),
  -- The day of the month it's due. A day the month doesn't have (31 in
  -- April, 30 in February) means the month's last day, like paydays; the
  -- app's date math handles that (task 4b).
  due_day smallint not null check (due_day between 1 and 31),
  -- Which month a quarterly or yearly bill is first due (1 = January), so
  -- the app knows its months (plan review 3.7). Empty for monthly bills.
  first_due_month smallint check (first_due_month between 1 and 12),
  -- Which payday pays it. split = half from each (twice-a-month budgets);
  -- every = the only payday (weekly and monthly budgets). Whether it fits the
  -- budget's frequency is checked by the app's Zod schema, like income
  -- sources (decided Nov 19).
  pay_slot text not null check (pay_slot in ('payday_1', 'payday_2', 'split', 'every')),
  -- Shows on the dashboard 2 days before it's due (Week 6).
  remind boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Quarterly and yearly bills need their first month; monthly bills don't
  -- have one. coalesce(..., false): a check that comes out null would pass.
  constraint recurring_bills_first_due_month_matches_frequency check (coalesce(
    case frequency
      when 'monthly' then first_due_month is null
      else first_due_month is not null
    end,
    false
  )),

  -- Same owner: the budget and the category must be the user's own.
  -- Deleting the budget deletes its bills.
  constraint recurring_bills_budget_fkey
    foreign key (budget_id, user_id) references public.budgets (id, user_id) on delete cascade,
  -- A category with bills can't be deleted; delete_category() moves them
  -- first (below). "no action" checks at the end of the statement, so
  -- deleting the whole account still works (same as transactions).
  constraint recurring_bills_category_fkey
    foreign key (category_id, user_id) references public.categories (id, user_id) on delete no action,

  -- Lets plan items (Week 5) require that a row and its bill have the same owner.
  constraint recurring_bills_id_user_id_key unique (id, user_id)
);

create index recurring_bills_user_id_idx on public.recurring_bills (user_id);
create index recurring_bills_budget_idx on public.recurring_bills (budget_id, user_id);
-- Keeps the delete check on categories fast.
create index recurring_bills_category_idx on public.recurring_bills (category_id, user_id);

create trigger recurring_bills_set_updated_at
before update on public.recurring_bills
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- A bill's category must be a spending category that isn't a system one
-- (Savings pot and Extra debt payment have their own flows). The app checks
-- it too; this is the backstop. Runs as the caller: the foreign key already
-- makes the category the caller's own, so RLS lets the lookup see it.
-- ---------------------------------------------------------------------------
create function public.check_bill_category()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  category record;
begin
  select kind, system_key, name into category
  from public.categories
  where id = new.category_id and user_id = new.user_id;

  -- Someone else's id finds nothing here, and the foreign key refuses it next.
  if found and (category.kind <> 'expense' or category.system_key is not null) then
    raise exception 'A bill can''t use the % category.', category.name
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger recurring_bills_check_category
before insert or update of category_id on public.recurring_bills
for each row execute function public.check_bill_category();

-- ---------------------------------------------------------------------------
-- Row Level Security: each user can only see and change their own rows.
-- Bills are hard-deleted (level 2, delete-pattern.md); past transactions stay.
-- ---------------------------------------------------------------------------
alter table public.recurring_bills enable row level security;

create policy "Users can read their own bills" on public.recurring_bills
for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can add their own bills" on public.recurring_bills
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own bills" on public.recurring_bills
for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own bills" on public.recurring_bills
for delete to authenticated using ((select auth.uid()) = user_id);

-- Table permissions. Take back Supabase's default grants. Logged-in users can
-- read, add and delete (RLS limits them to their own), and update only the
-- New bill form's fields: never the ids, owner, budget or timestamps.
revoke all on public.recurring_bills from anon, authenticated;
grant select, insert, delete on public.recurring_bills to authenticated;
grant update (name, amount, amount_varies, category_id, frequency, due_day, first_due_month, pay_slot, remind)
on public.recurring_bills to authenticated;

-- ---------------------------------------------------------------------------
-- delete_category() again (from 20261124093000), now also moving the
-- category's bills. Unchanged otherwise: still one call, one transaction.
-- ---------------------------------------------------------------------------
create or replace function public.delete_category(target_category uuid, move_to uuid default null)
-- How many transactions moved (soft-deleted ones included).
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  target public.categories%rowtype;
  destination public.categories%rowtype;
  moved integer := 0;
begin
  select * into target from public.categories where id = target_category and user_id = me;
  if not found then
    raise exception 'That category no longer exists.' using errcode = 'P0002';
  end if;
  if target.system_key is not null then
    raise exception '% is a system category and can''t be deleted.', target.name using errcode = '42501';
  end if;

  -- Anything pointing at it (transactions, soft-deleted ones included, or
  -- bills) has to move first.
  if exists (select 1 from public.transactions where category_id = target.id and user_id = me)
    or exists (select 1 from public.recurring_bills where category_id = target.id and user_id = me)
  then
    select * into destination from public.categories where id = move_to and user_id = me;
    if not found or destination.id = target.id or destination.system_key is not null
      or destination.kind <> target.kind
    then
      raise exception 'Pick another category to move its transactions to.' using errcode = '22023';
    end if;

    update public.transactions set category_id = destination.id
    where category_id = target.id and user_id = me;
    get diagnostics moved = row_count;

    update public.recurring_bills set category_id = destination.id
    where category_id = target.id and user_id = me;
  end if;

  delete from public.categories where id = target.id and user_id = me;
  return moved;
end;
$$;

-- create or replace keeps the grants, but say them again to be sure.
revoke execute on function public.delete_category(uuid, uuid) from public, anon;
grant execute on function public.delete_category(uuid, uuid) to authenticated;
