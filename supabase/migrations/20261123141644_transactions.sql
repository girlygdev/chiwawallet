-- transactions: every peso in and out (mvp-brief.md data model; Week 3, task
-- 3a). Decisions: plan review 3.5 and 3.6, and the 3a-2 plan (owner, Nov 23).
-- pot_id, debt_id and plan_item_id are added with their tables in Weeks 4-5.

-- ---------------------------------------------------------------------------
-- Same-owner keys on two existing tables, so a transaction can require that
-- its period and income source belong to the same user (like budgets and
-- categories). ids are already unique, so this can't fail on existing rows.
-- ---------------------------------------------------------------------------
alter table public.budget_periods
  add constraint budget_periods_id_user_id_key unique (id, user_id);
alter table public.income_sources
  add constraint income_sources_id_user_id_key unique (id, user_id);

-- ---------------------------------------------------------------------------
-- The table
-- ---------------------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  -- Filled in from the logged-in user, so the app never sends it.
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  period_id uuid not null,
  category_id uuid not null,
  type text not null check (type in ('income', 'expense', 'savings', 'debt_payment')),
  -- Centavos. Above zero, except savings: a negative savings amount is a pot
  -- withdrawal and zero means nothing (plan review 3.5).
  amount bigint not null,
  -- The day it happened, in Manila time. Must fall inside its period (see the
  -- trigger below).
  date date not null,
  -- Optional; one-time income saves its name here.
  note text check (note is null or char_length(btrim(note)) between 1 and 100),
  -- Which income source this pay came from; empty for one-time income.
  income_source_id uuid,
  -- Soft delete (level 1): set to delete, cleared to undo. Every query
  -- filters deleted_at is null.
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint transactions_amount_sign check (
    case type
      when 'savings' then amount <> 0
      else amount > 0
    end
  ),

  constraint transactions_income_source_only_on_income
    check (income_source_id is null or type = 'income'),

  -- Same owner: each link is checked together with user_id, so nobody can
  -- attach a transaction to someone else's period, category or source.
  -- Deleting the budget deletes its periods, which deletes their transactions.
  constraint transactions_period_fkey
    foreign key (period_id, user_id) references public.budget_periods (id, user_id) on delete cascade,
  -- A category with transactions can't be deleted; the app moves them first
  -- (plan review 3.6). "no action" refuses it just like "restrict", but checks
  -- at the end of the statement, so deleting the whole account (which removes
  -- categories and transactions together) still works.
  constraint transactions_category_fkey
    foreign key (category_id, user_id) references public.categories (id, user_id) on delete no action,
  -- Deleting the source keeps the transaction; only income_source_id is
  -- emptied (the column list keeps user_id as it is).
  constraint transactions_income_source_fkey
    foreign key (income_source_id, user_id) references public.income_sources (id, user_id)
    on delete set null (income_source_id)
);

create index transactions_user_id_idx on public.transactions (user_id);
-- The Activity list and period totals: live rows of one period.
create index transactions_period_live_idx on public.transactions (period_id, user_id)
  where deleted_at is null;
-- Keep the delete checks on categories and income sources fast.
create index transactions_category_idx on public.transactions (category_id, user_id);
create index transactions_income_source_idx on public.transactions (income_source_id, user_id)
  where income_source_id is not null;

create trigger transactions_set_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Checks that need another table, so they can't be plain check constraints.
-- The app (Zod) checks both too; this is the backstop.
-- 1. The date falls inside the period's dates.
-- 2. The type matches the category: income rows use an income category,
--    every other type an expense category.
-- Runs as the caller: the foreign keys already make the period and category
-- the caller's own, so RLS lets the lookups see them.
-- ---------------------------------------------------------------------------
create function public.check_transaction_links()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  period_start date;
  period_end date;
  category_kind text;
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

  -- A missing period or category (someone else's id) finds nothing here, and
  -- the foreign key refuses the row right after; only check what was found.
  if category_kind is not null and category_kind <> (case when new.type = 'income' then 'income' else 'expense' end) then
    raise exception 'A % transaction can''t use a % category.', new.type, category_kind
      using errcode = '23514';
  end if;

  return new;
end;
$$;

-- Only when a linked field is set or changes. Soft delete, undo and the
-- income source's "set null" don't touch these columns, so they skip it.
create trigger transactions_check_links
before insert or update of period_id, category_id, type, date on public.transactions
for each row execute function public.check_transaction_links();

-- ---------------------------------------------------------------------------
-- Row Level Security: each user can only see and change their own rows.
-- No delete policy: the app soft-deletes (deleted_at). The 30-day purge
-- (Week 8) runs as the table owner.
-- ---------------------------------------------------------------------------
alter table public.transactions enable row level security;

create policy "Users can read their own transactions" on public.transactions
for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can add their own transactions" on public.transactions
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own transactions" on public.transactions
for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Table permissions. Take back Supabase's default grants. Logged-in users can
-- read, add with only the listed columns, and update only the listed columns
-- (deleted_at is how they delete and undo). Never the ids, user_id or
-- timestamps, and no hard delete.
revoke all on public.transactions from anon, authenticated;
grant select on public.transactions to authenticated;
grant insert (period_id, category_id, type, amount, date, note, income_source_id)
on public.transactions to authenticated;
grant update (period_id, category_id, type, amount, date, note, income_source_id, deleted_at)
on public.transactions to authenticated;
