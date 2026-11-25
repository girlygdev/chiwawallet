-- plan_items: each period's plan (mvp-brief.md data model; Week 5, task 5a).
-- Decisions: plan review 3.6, 3.9 and 3.10, and the 5a plan (owner, Nov 25):
-- - budget_group, only for starter items, which have no category (3.9).
-- - Spending budgets copied from categories.default_budget are `recurring`
--   items with a category and no other link (3.10).
-- - `edited`: set by the app when you change an item by hand, so a later
--   change to its bill or pot (5h) leaves it alone.
-- - The locked "Debt payment" system category (Needs) for planned debt
--   payments, moved here from Week 6 because generated debt items need it.

-- ---------------------------------------------------------------------------
-- 1. The "Debt payment" system category
-- ---------------------------------------------------------------------------
alter table public.categories drop constraint categories_system_key_check;
alter table public.categories add constraint categories_system_key_check
  check (system_key in ('income', 'savings_pot', 'extra_debt', 'debt_payment'));

-- Planned debt payments count as Needs (CLAUDE.md, 50/30/20 rules); extra
-- payments stay Savings & debt payoff.
alter table public.categories drop constraint categories_system_key_shape;
alter table public.categories add constraint categories_system_key_shape check (
  system_key is null
  or (system_key = 'income' and kind = 'income')
  or (system_key in ('savings_pot', 'extra_debt') and kind = 'expense' and budget_group = 'savings_debt')
  or (system_key = 'debt_payment' and kind = 'expense' and budget_group = 'needs')
);

-- New sign-ups: the list from 20261124120000, plus the last row.
create or replace function public.add_default_categories(target_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.categories (user_id, name, kind, budget_group, icon, color, system_key)
  values
    (target_user, 'Meals',              'expense', 'needs',        'utensils',        'green',  null),
    (target_user, 'Groceries',          'expense', 'needs',        'shopping-cart',   'green',  null),
    (target_user, 'Market',             'expense', 'needs',        'store',           'orange', null),
    (target_user, 'Transport',          'expense', 'needs',        'car',             'blue',   null),
    (target_user, 'Bills',              'expense', 'needs',        'zap',             'yellow', null),
    (target_user, 'Rent',               'expense', 'needs',        'house',           'orange', null),
    (target_user, 'Load & data',        'expense', 'needs',        'wifi',            'blue',   null),
    (target_user, 'Health',             'expense', 'needs',        'heart-pulse',     'red',    null),
    (target_user, 'Padala',             'expense', 'needs',        'smartphone',      'purple', null),
    (target_user, 'Personal',           'expense', 'wants',        'scissors',        'purple', null),
    (target_user, 'Shopping',           'expense', 'wants',        'shirt',           'orange', null),
    (target_user, 'Dining out',         'expense', 'wants',        'coffee',          'yellow', null),
    (target_user, 'Fun',                'expense', 'wants',        'gamepad-2',       'purple', null),
    (target_user, 'Gifts',              'expense', 'wants',        'gift',            'red',    null),
    (target_user, 'Travel',             'expense', 'wants',        'plane',           'blue',   null),
    (target_user, 'Subscriptions',      'expense', 'wants',        'tv',              'purple', null),
    (target_user, 'Income',             'income',  null,           'wallet',          'green',  'income'),
    (target_user, 'Savings pot',        'expense', 'savings_debt', 'piggy-bank',      'green',  'savings_pot'),
    (target_user, 'Extra debt payment', 'expense', 'savings_debt', 'credit-card',     'red',    'extra_debt'),
    (target_user, 'Debt payment',       'expense', 'needs',        'credit-card',     'orange', 'debt_payment') -- new
  on conflict do nothing;
end;
$$;

revoke execute on function public.add_default_categories(uuid) from public, anon, authenticated;

-- Existing accounts. Someone may already have their own "Debt payment"
-- category (names are unique per user), so they get "Planned debt payment".
insert into public.categories (user_id, name, kind, budget_group, icon, color, system_key)
select u.id, 'Debt payment', 'expense', 'needs', 'credit-card', 'orange', 'debt_payment'
from auth.users u
on conflict do nothing;

insert into public.categories (user_id, name, kind, budget_group, icon, color, system_key)
select u.id, 'Planned debt payment', 'expense', 'needs', 'credit-card', 'orange', 'debt_payment'
from auth.users u
where not exists (
  select 1 from public.categories c where c.user_id = u.id and c.system_key = 'debt_payment'
)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 2. The table
-- ---------------------------------------------------------------------------
create table public.plan_items (
  id uuid primary key default gen_random_uuid(),
  -- Filled in from the logged-in user, so the app never sends it.
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  period_id uuid not null,
  -- 1-40 characters, like bill and pot names (a generated item copies its
  -- source's name).
  name text not null check (char_length(btrim(name)) between 1 and 40),
  -- Empty only on starter items, which carry a budget_group instead (3.9).
  category_id uuid,
  budget_group text check (budget_group in ('needs', 'wants', 'savings_debt')),
  -- Centavos, above zero.
  planned_amount bigint not null check (planned_amount > 0),
  -- recurring: generated from an income source, bill, pot, scheduled debt
  --            payment or a category's budget per payday.
  -- one_off:   added by hand (and a recurring item whose source is gone).
  -- starter:   the 50/30/20 starter plan.
  -- assigned:  Give leftover a job (Week 6).
  origin text not null check (origin in ('recurring', 'one_off', 'starter', 'assigned')),
  -- One-off items only: the date it's needed by (plan.md §6).
  needed_by date,
  income_source_id uuid,
  bill_id uuid,
  pot_id uuid,
  debt_id uuid,
  -- Changed by hand (5e), so syncing from its source (5h) skips it.
  edited boolean not null default false,
  -- Set by Mark paid (Week 6).
  paid_at timestamptz,
  -- Soft delete (level 1): set to delete, cleared to undo. Every query
  -- filters deleted_at is null.
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Starter items have a group and no category; every other item has a
  -- category and no group.
  constraint plan_items_category_or_group check (
    case origin
      when 'starter' then category_id is null and budget_group is not null
      else category_id is not null and budget_group is null
    end
  ),

  constraint plan_items_needed_by_only_one_off check (needed_by is null or origin = 'one_off'),

  -- At most one source. Bills and income sources only make recurring items;
  -- starter items have no source. A deleted source empties its link, which
  -- these checks always allow.
  constraint plan_items_one_link check (num_nonnulls(income_source_id, bill_id, pot_id, debt_id) <= 1),
  constraint plan_items_bill_and_income_only_recurring check (
    (bill_id is null and income_source_id is null) or origin = 'recurring'
  ),
  constraint plan_items_starter_no_link check (
    origin <> 'starter' or num_nonnulls(income_source_id, bill_id, pot_id, debt_id) = 0
  ),

  -- Same owner: each link is checked together with user_id, so nobody can
  -- attach an item to someone else's period, category or source.
  -- Deleting a period deletes its plan.
  constraint plan_items_period_fkey
    foreign key (period_id, user_id) references public.budget_periods (id, user_id) on delete cascade,
  -- A category with plan items can't be deleted; delete_category() moves
  -- them first ("no action" so deleting the whole account still works).
  constraint plan_items_category_fkey
    foreign key (category_id, user_id) references public.categories (id, user_id) on delete no action,
  -- Deleting a source keeps past items, with only the link emptied (3.6).
  -- Its unpaid current and future items are removed first (section 4).
  constraint plan_items_income_source_fkey
    foreign key (income_source_id, user_id) references public.income_sources (id, user_id)
    on delete set null (income_source_id),
  constraint plan_items_bill_fkey
    foreign key (bill_id, user_id) references public.recurring_bills (id, user_id)
    on delete set null (bill_id),
  constraint plan_items_pot_fkey
    foreign key (pot_id, user_id) references public.savings_pots (id, user_id)
    on delete set null (pot_id),
  constraint plan_items_debt_fkey
    foreign key (debt_id, user_id) references public.debts (id, user_id)
    on delete set null (debt_id),

  -- Lets transactions require that their plan item has the same owner.
  constraint plan_items_id_user_id_key unique (id, user_id)
);

create index plan_items_user_id_idx on public.plan_items (user_id);
-- The Plan screen: live items of one period.
create index plan_items_period_live_idx on public.plan_items (period_id, user_id) where deleted_at is null;
-- Keep the delete checks on categories and sources fast.
create index plan_items_category_idx on public.plan_items (category_id, user_id) where category_id is not null;
create index plan_items_income_source_idx on public.plan_items (income_source_id, user_id) where income_source_id is not null;
create index plan_items_bill_idx on public.plan_items (bill_id, user_id) where bill_id is not null;
create index plan_items_pot_idx on public.plan_items (pot_id, user_id) where pot_id is not null;
create index plan_items_debt_idx on public.plan_items (debt_id, user_id) where debt_id is not null;

-- ---------------------------------------------------------------------------
-- No duplicate generated items. Opening a period generates its recurring
-- items and skips any already there, so it's safe from two tabs and safe to
-- run again when a new bill is added. Skipping needs SQL's bare
-- "on conflict do nothing": the API's upsert only targets the primary key,
-- not these partial indexes, so 5c adds a small function for it.
-- Soft-deleted rows count too: an item you deleted never comes back.
-- Debt installments are monthly, so one payment of a debt per period.
-- ---------------------------------------------------------------------------
create unique index plan_items_income_key on public.plan_items (period_id, income_source_id)
  where origin = 'recurring' and income_source_id is not null;
create unique index plan_items_bill_key on public.plan_items (period_id, bill_id)
  where origin = 'recurring' and bill_id is not null;
create unique index plan_items_pot_key on public.plan_items (period_id, pot_id)
  where origin = 'recurring' and pot_id is not null;
create unique index plan_items_debt_key on public.plan_items (period_id, debt_id)
  where origin = 'recurring' and debt_id is not null;
-- Spending budgets: a recurring item with no source, one per category.
create unique index plan_items_budget_key on public.plan_items (period_id, category_id)
  where origin = 'recurring'
    and income_source_id is null and bill_id is null and pot_id is null and debt_id is null;
-- The starter plan once per period, so a double tap can't add it twice.
-- Live rows only: after deleting it you can use it again.
create unique index plan_items_starter_key on public.plan_items (period_id, budget_group)
  where origin = 'starter' and deleted_at is null;

create trigger plan_items_set_updated_at
before update on public.plan_items
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Checks and rules that need more than one row
-- ---------------------------------------------------------------------------

-- An income item uses an income category; every other item an expense
-- category. A category can only change to one of the same kind. Runs as the
-- caller: the foreign key already makes the category the caller's own.
create function public.check_plan_item_category()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  new_kind text;
  old_kind text;
begin
  if new.category_id is null then
    return new;
  end if;

  select kind into new_kind
  from public.categories
  where id = new.category_id and user_id = new.user_id;
  -- Someone else's id finds nothing here; the foreign key refuses it next.
  if new_kind is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new_kind <> (case when new.income_source_id is not null then 'income' else 'expense' end) then
      raise exception 'This plan item can''t use a % category.', new_kind using errcode = '23514';
    end if;
  else
    select kind into old_kind
    from public.categories
    where id = old.category_id and user_id = old.user_id;
    if old_kind is not null and new_kind <> old_kind then
      raise exception 'A plan item''s category can only change to another % category.', old_kind
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger plan_items_check_category
before insert or update of category_id on public.plan_items
for each row execute function public.check_plan_item_category();

-- A recurring item that loses what it was generated from becomes a one-off
-- in its period: its source was deleted (the link is emptied), or a spending
-- budget's category changed (delete_category() moves it). This keeps the
-- unique keys above meaning "generated from this source", so a past Meralco
-- item can't clash with a Bills spending budget once Meralco is deleted.
-- Changing NEW in a trigger needs no column permission.
create function public.detach_plan_item()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  had_source boolean := num_nonnulls(old.income_source_id, old.bill_id, old.pot_id, old.debt_id) > 0;
  has_source boolean := num_nonnulls(new.income_source_id, new.bill_id, new.pot_id, new.debt_id) > 0;
begin
  if old.origin = 'recurring' and new.origin = 'recurring'
    and ((had_source and not has_source)
      or (not had_source and new.category_id is distinct from old.category_id))
  then
    new.origin := 'one_off';
  end if;
  return new;
end;
$$;

create trigger plan_items_detach
before update of category_id, income_source_id, bill_id, pot_id, debt_id on public.plan_items
for each row execute function public.detach_plan_item();

-- ---------------------------------------------------------------------------
-- 4. Deleting a bill, pot, debt or income source removes its unpaid items in
-- periods that haven't ended (today in Manila or later). Paid and past items
-- stay as history (mvp-brief.md: "only future plan items are removed").
-- Runs before the delete, while the link is still set. Runs as the table
-- owner, because deleting an account cascades into these tables as the Auth
-- service, which can't update plan_items. It only touches the deleted row's
-- owner's items, and only when RLS has already let that row be deleted.
-- ---------------------------------------------------------------------------
create function public.remove_future_plan_items()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Manila')::date;
begin
  update public.plan_items i
  set deleted_at = now()
  from public.budget_periods p
  where p.id = i.period_id
    and p.user_id = i.user_id
    and p.end_date >= today
    and i.user_id = old.user_id
    and i.paid_at is null
    and i.deleted_at is null
    and case tg_table_name
      when 'recurring_bills' then i.bill_id = old.id
      when 'savings_pots' then i.pot_id = old.id
      when 'debts' then i.debt_id = old.id
      when 'income_sources' then i.income_source_id = old.id
    end;
  return old;
end;
$$;

create trigger recurring_bills_remove_future_plan_items
before delete on public.recurring_bills
for each row execute function public.remove_future_plan_items();
create trigger savings_pots_remove_future_plan_items
before delete on public.savings_pots
for each row execute function public.remove_future_plan_items();
create trigger debts_remove_future_plan_items
before delete on public.debts
for each row execute function public.remove_future_plan_items();
create trigger income_sources_remove_future_plan_items
before delete on public.income_sources
for each row execute function public.remove_future_plan_items();

-- ---------------------------------------------------------------------------
-- 5. transactions.plan_item_id: which plan item a transaction paid. Mark
-- paid (Week 6) fills it in; its column permission comes then too.
-- ---------------------------------------------------------------------------
alter table public.transactions add column plan_item_id uuid;
alter table public.transactions add constraint transactions_plan_item_fkey
  foreign key (plan_item_id, user_id) references public.plan_items (id, user_id)
  on delete set null (plan_item_id);
create index transactions_plan_item_idx on public.transactions (plan_item_id, user_id)
  where plan_item_id is not null;

-- ---------------------------------------------------------------------------
-- 6. delete_category() again (from 20261124140000), now also moving the
-- category's plan items. Unchanged otherwise: still one call, one
-- transaction. Starter items have no category, so they never move.
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

  -- Anything pointing at it (transactions or plan items, soft-deleted ones
  -- included, or bills) has to move first.
  if exists (select 1 from public.transactions where category_id = target.id and user_id = me)
    or exists (select 1 from public.recurring_bills where category_id = target.id and user_id = me)
    or exists (select 1 from public.plan_items where category_id = target.id and user_id = me)
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

    -- A spending budget for this category becomes a one-off in its period
    -- (detach_plan_item()), so it can't clash with the destination's own.
    update public.plan_items set category_id = destination.id
    where category_id = target.id and user_id = me;
  end if;

  delete from public.categories where id = target.id and user_id = me;
  return moved;
end;
$$;

revoke execute on function public.delete_category(uuid, uuid) from public, anon;
grant execute on function public.delete_category(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Row Level Security: each user can only see and change their own rows.
-- No delete policy: the app soft-deletes (deleted_at). The 30-day purge
-- (Week 8) runs as the table owner.
-- ---------------------------------------------------------------------------
alter table public.plan_items enable row level security;

create policy "Users can read their own plan items" on public.plan_items
for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can add their own plan items" on public.plan_items
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own plan items" on public.plan_items
for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Table permissions. Take back Supabase's default grants. Logged-in users can
-- read, add with only the listed columns, and update what Edit item changes
-- (name, amount, needed by, category, which payday), the edited flag, and
-- deleted_at (delete and undo). Never the ids, owner, origin, links or
-- timestamps; paid_at comes with Mark paid (Week 6). No hard delete.
revoke all on public.plan_items from anon, authenticated;
grant select on public.plan_items to authenticated;
grant insert (period_id, name, category_id, budget_group, planned_amount, origin, needed_by,
  income_source_id, bill_id, pot_id, debt_id)
on public.plan_items to authenticated;
grant update (period_id, name, category_id, planned_amount, needed_by, edited, deleted_at)
on public.plan_items to authenticated;
