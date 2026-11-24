-- savings_pots and debts, and their links on transactions (mvp-brief.md data
-- model; Week 4, task 4a-2). Decisions: plan review 3.5, 3.6, 3.8, and the
-- Week 4 plan (owner, Nov 24): no split pay slot for pots; Emergency Fund and
-- Sinking Funds are default pots. Pots and debts belong to the user, not a
-- budget. Balances are worked out from transactions, never stored.

-- ---------------------------------------------------------------------------
-- savings_pots
-- ---------------------------------------------------------------------------
create table public.savings_pots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  -- A Lucide icon name, like 'laptop' (the New pot form's choices, 4d).
  icon text not null check (icon ~ '^[a-z0-9-]{1,40}$'),
  -- The six category colours (more-and-categories.md §2).
  color text not null check (color in ('orange', 'blue', 'purple', 'yellow', 'red', 'green')),
  -- Optional goal, in centavos.
  target_amount bigint check (target_amount > 0),
  -- Optional goal month, stored as its first day (the form picks a month).
  target_date date check (target_date is null or extract(day from target_date) = 1),
  -- "Already saved" when the pot was made. Default pots start at ₱0.
  starting_balance bigint not null default 0 check (starting_balance >= 0),
  -- "Save each time", per payday. ₱0 is allowed so the default pots can
  -- start empty; the New pot form asks for it (savings.md §4).
  planned_contribution bigint not null default 0 check (planned_contribution >= 0),
  -- No split for pots (plan review 3.8). every = each payday.
  pay_slot text not null default 'every' check (pay_slot in ('payday_1', 'payday_2', 'every')),
  -- Deposits only, like MP2 or time deposits (savings.md §5).
  is_locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Lets transactions and plan items require that a row and its pot have the same owner.
  constraint savings_pots_id_user_id_key unique (id, user_id)
);

-- Pot names are unique per user, ignoring case and outer spaces, like categories.
create unique index savings_pots_user_name_key on public.savings_pots (user_id, lower(btrim(name)));

create trigger savings_pots_set_updated_at
before update on public.savings_pots
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- debts
-- ---------------------------------------------------------------------------
create table public.debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  -- Optional: "e.g. bank or app".
  lender text check (lender is null or char_length(btrim(lender)) between 1 and 40),
  -- The whole amount owed, in centavos.
  total_amount bigint not null check (total_amount > 0),
  payment_type text not null check (payment_type in ('installments', 'one_time')),
  num_payments smallint not null,
  -- Each payment, in centavos. The form fills in total ÷ payments, still
  -- editable (debts.md §4), so it doesn't have to divide evenly.
  payment_amount bigint not null check (payment_amount > 0),
  -- Installments are monthly from here; a one-time debt is due on this day.
  first_due_date date not null,
  -- Display only in the MVP (debts.md §1). Percent, like 3.5.
  interest_rate numeric(5, 2) check (interest_rate between 0 and 100),
  -- Set when "left" reaches ₱0, or by "Mark it paid off" (4f).
  paid_off_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Installments: 2-60 payments. One payment: exactly one, of the full amount.
  constraint debts_payments_match_type check (coalesce(
    case payment_type
      when 'installments' then num_payments between 2 and 60
      when 'one_time' then num_payments = 1 and payment_amount = total_amount
    end,
    false
  )),
  constraint debts_id_user_id_key unique (id, user_id)
);

create trigger debts_set_updated_at
before update on public.debts
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Links on transactions. Deleting a pot or debt keeps its past transactions
-- and empties only the link (plan review 3.6); "set null (pot_id)" leaves
-- user_id as it is. A pot only on savings rows, a debt only on debt payments.
-- ---------------------------------------------------------------------------
alter table public.transactions
  add column pot_id uuid,
  add column debt_id uuid,
  add constraint transactions_pot_only_on_savings check (pot_id is null or type = 'savings'),
  add constraint transactions_debt_only_on_debt_payments check (debt_id is null or type = 'debt_payment'),
  add constraint transactions_pot_fkey
    foreign key (pot_id, user_id) references public.savings_pots (id, user_id) on delete set null (pot_id),
  add constraint transactions_debt_fkey
    foreign key (debt_id, user_id) references public.debts (id, user_id) on delete set null (debt_id);

create index transactions_pot_idx on public.transactions (pot_id, user_id) where pot_id is not null;
create index transactions_debt_idx on public.transactions (debt_id, user_id) where debt_id is not null;

-- check_transaction_links() again (from the transactions migration), with
-- two more checks:
-- 3. A new savings row needs a pot and a new debt payment needs a debt.
--    Only when the row is added or its type changes: a deleted pot or debt
--    empties the link later, and that has to stay allowed.
-- 4. Nothing can be withdrawn from a locked pot (savings.md §5).
create or replace function public.check_transaction_links()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  period_start date;
  period_end date;
  category_kind text;
  pot_locked boolean;
begin
  select start_date, end_date into period_start, period_end
  from public.budget_periods
  where id = new.period_id and user_id = new.user_id;

  if new.date not between period_start and period_end then
    raise exception 'The date % is outside its period (% to %).', new.date, period_start, period_end
      using errcode = '23514';
  end if;

  select kind into category_kind
  from public.categories
  where id = new.category_id and user_id = new.user_id;

  if category_kind is not null and category_kind <> (case when new.type = 'income' then 'income' else 'expense' end) then
    raise exception 'A % transaction can''t use a % category.', new.type, category_kind
      using errcode = '23514';
  end if;

  -- Only when the row is added or its type changes. Deleting a pot or debt
  -- empties the link with an update of pot_id or debt_id, which runs this
  -- trigger too, and that has to stay allowed (plan review 3.6).
  if tg_op = 'INSERT' or new.type is distinct from old.type then
    if new.type = 'savings' and new.pot_id is null then
      raise exception 'A savings transaction needs a pot.' using errcode = '23514';
    end if;
    if new.type = 'debt_payment' and new.debt_id is null then
      raise exception 'A debt payment needs a debt.' using errcode = '23514';
    end if;
  end if;

  if new.pot_id is not null and new.amount < 0 then
    select is_locked into pot_locked
    from public.savings_pots
    where id = new.pot_id and user_id = new.user_id;
    if pot_locked then
      raise exception 'This pot is locked: deposits only.' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

-- The same trigger, now also when the amount, pot or debt is set or changes.
-- Soft delete, undo and the "set null" links still skip it.
drop trigger transactions_check_links on public.transactions;
create trigger transactions_check_links
before insert or update of period_id, category_id, type, date, amount, pot_id, debt_id on public.transactions
for each row execute function public.check_transaction_links();

-- The app may set the links when adding and editing.
grant insert (pot_id, debt_id) on public.transactions to authenticated;
grant update (pot_id, debt_id) on public.transactions to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security: each user can only see and change their own rows.
-- Pots and debts are hard-deleted (level 2, delete-pattern.md).
-- ---------------------------------------------------------------------------
alter table public.savings_pots enable row level security;
alter table public.debts enable row level security;

create policy "Users can read their own pots" on public.savings_pots
for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can add their own pots" on public.savings_pots
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own pots" on public.savings_pots
for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own pots" on public.savings_pots
for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users can read their own debts" on public.debts
for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can add their own debts" on public.debts
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own debts" on public.debts
for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own debts" on public.debts
for delete to authenticated using ((select auth.uid()) = user_id);

-- Table permissions: read, add and delete (RLS limits them to their own), and
-- update only the form fields. Never the ids, owner or timestamps.
revoke all on public.savings_pots, public.debts from anon, authenticated;
grant select, insert, delete on public.savings_pots, public.debts to authenticated;
grant update (name, icon, color, target_amount, target_date, starting_balance, planned_contribution, pay_slot, is_locked)
on public.savings_pots to authenticated;
grant update (name, lender, total_amount, payment_type, num_payments, payment_amount, first_due_date, interest_rate, paid_off_at)
on public.debts to authenticated;

-- ---------------------------------------------------------------------------
-- Default pots (owner, Nov 24): Emergency Fund and Sinking Funds, empty, for
-- each user to fill in. Ordinary pots: they can be edited and deleted.
-- ---------------------------------------------------------------------------
create function public.add_default_pots(target_user uuid)
returns void
language plpgsql
-- Runs as the table owner: at sign-up the new user isn't logged in yet.
security definer
set search_path = ''
as $$
begin
  insert into public.savings_pots (user_id, name, icon, color)
  values
    (target_user, 'Emergency Fund', 'life-buoy',      'red'),
    (target_user, 'Sinking Funds',  'calendar-clock', 'blue')
  -- Skips a pot the user already has with the same name.
  on conflict do nothing;
end;
$$;

revoke execute on function public.add_default_pots(uuid) from public, anon, authenticated;

-- handle_new_user() again, unchanged from the categories migration except for
-- the last perform, which also adds the default pots.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name, consent_at, consent_version)
  values (
    new.id,
    nullif(left(btrim(new.raw_user_meta_data ->> 'display_name'), 40), ''),
    case when new.raw_user_meta_data ? 'consent_at' then now() end,
    case
      when new.raw_user_meta_data ? 'consent_at'
        and new.raw_user_meta_data ->> 'consent_version' ~ '^\d{4}-\d{2}-\d{2}$'
      then new.raw_user_meta_data ->> 'consent_version'
    end
  );

  perform public.add_default_categories(new.id);
  perform public.add_default_pots(new.id);
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Default pots for accounts made before this migration.
select public.add_default_pots(id) from auth.users;
