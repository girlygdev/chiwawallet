-- budgets, income_sources and budget_periods (mvp-brief.md data model; Week 2).
-- Decisions: plan review 3.1-3.3, 3.13, 3.14 (docs/plan-review-2026-11-19.md).
-- Money is bigint centavos. Dates are plain `date` values in Manila time.

-- ---------------------------------------------------------------------------
-- budgets: one pay schedule and its settings.
-- ---------------------------------------------------------------------------
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  -- Filled in from the logged-in user, so the app never sends it.
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  frequency text not null check (frequency in ('weekly', 'semi_monthly', 'monthly')),
  pay_day_1 smallint,
  pay_day_2 smallint,
  -- 0 = Sunday ... 6 = Saturday, like extract(dow) and JavaScript's getDay().
  pay_weekday smallint,
  -- Empty until onboarding step 3 (plan review 3.1). Zero and negative
  -- amounts are real answers, so there's no >= 0 check.
  opening_balance bigint,
  carry_over boolean not null default true,
  ask_on_payday boolean not null default true,
  budget_model text not null default '50_30_20' check (budget_model in ('50_30_20')),
  needs_pct smallint not null default 50 check (needs_pct between 0 and 100),
  wants_pct smallint not null default 30 check (wants_pct between 0 and 100),
  savings_debt_pct smallint not null default 20 check (savings_debt_pct between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint budgets_pcts_add_to_100
    check (needs_pct + wants_pct + savings_debt_pct = 100),

  -- Each frequency uses only its own payday fields. Same rules as
  -- getPeriod() in src/lib/periods.ts: semi-monthly payday 1 is the 27th or
  -- earlier so it can't land on payday 2 in February.
  -- coalesce(..., false): a check that comes out null counts as passing in
  -- Postgres, so a missing payday (null between 1 and 31 is null) must fail.
  constraint budgets_paydays_match_frequency check (coalesce(
    case frequency
      when 'semi_monthly' then
        pay_day_1 between 1 and 27
        and pay_day_2 between 1 and 31
        and pay_day_2 > pay_day_1
        and pay_weekday is null
      when 'monthly' then
        pay_day_1 between 1 and 31
        and pay_day_2 is null
        and pay_weekday is null
      when 'weekly' then
        pay_weekday between 0 and 6
        and pay_day_1 is null
        and pay_day_2 is null
    end,
    false
  )),

  -- Lets the tables below require that a row and its budget have the same
  -- owner (see "same owner" below).
  constraint budgets_id_user_id_key unique (id, user_id)
);

create index budgets_user_id_idx on public.budgets (user_id);

create trigger budgets_set_updated_at
before update on public.budgets
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- income_sources: an amount and the payday it lands on.
-- Whether pay_slot fits the budget's frequency (no payday_2 on a monthly
-- budget) is checked by the app's Zod schema, not here (decided Nov 19).
-- ---------------------------------------------------------------------------
create table public.income_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  budget_id uuid not null,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  -- Always above zero; when amount_varies is on it's an estimate (decided Nov 19).
  amount bigint not null check (amount > 0),
  amount_varies boolean not null default false,
  pay_slot text not null check (pay_slot in ('payday_1', 'payday_2', 'every')),
  -- Defaults to the first period's start, set by the app (plan review 3.3).
  start_date date not null,
  -- For a job that stops (plan review 3.2).
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint income_sources_end_after_start
    check (end_date is null or end_date >= start_date),

  -- Same owner: the pair (budget_id, user_id) must exist in budgets. RLS only
  -- checks that user_id is yours; without this, someone who guessed another
  -- person's budget id could attach rows to it. Deleting the budget deletes
  -- its income sources.
  constraint income_sources_budget_fkey
    foreign key (budget_id, user_id) references public.budgets (id, user_id) on delete cascade
);

create index income_sources_user_id_idx on public.income_sources (user_id);
create index income_sources_budget_id_idx on public.income_sources (budget_id, user_id);

create trigger income_sources_set_updated_at
before update on public.income_sources
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- budget_periods: one row per payday-to-payday period, created the first
-- time the period is opened (task 2c).
-- ---------------------------------------------------------------------------
create table public.budget_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  budget_id uuid not null,
  start_date date not null,
  end_date date not null,
  pay_slot text not null check (pay_slot in ('payday_1', 'payday_2', 'every')),
  -- Money carried in from the last period, in centavos. Can be negative.
  carried_in bigint not null default 0,
  -- What the user chose to do with last period's leftover; empty until chosen.
  leftover_choice text check (leftover_choice in ('carry', 'pot', 'debt', 'split')),
  -- Onboarding mid-period: "Has your pay already arrived?" (plan review 3.14).
  -- Week 3 turns a yes into a received income transaction.
  first_pay_received boolean not null default false,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint budget_periods_end_after_start check (end_date >= start_date),
  -- One period per start date, so opening the app twice can't create two.
  constraint budget_periods_budget_start_key unique (budget_id, start_date),
  constraint budget_periods_budget_fkey
    foreign key (budget_id, user_id) references public.budgets (id, user_id) on delete cascade
);

create index budget_periods_user_id_idx on public.budget_periods (user_id);
create index budget_periods_budget_user_idx on public.budget_periods (budget_id, user_id);

create trigger budget_periods_set_updated_at
before update on public.budget_periods
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: each user can only see and change their own rows.
-- ---------------------------------------------------------------------------
alter table public.budgets enable row level security;
alter table public.income_sources enable row level security;
alter table public.budget_periods enable row level security;

create policy "Users can read their own budgets" on public.budgets
for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can add their own budgets" on public.budgets
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own budgets" on public.budgets
for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own budgets" on public.budgets
for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users can read their own income sources" on public.income_sources
for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can add their own income sources" on public.income_sources
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own income sources" on public.income_sources
for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own income sources" on public.income_sources
for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Users can read their own periods" on public.budget_periods
for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can add their own periods" on public.budget_periods
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own periods" on public.budget_periods
for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users can delete their own periods" on public.budget_periods
for delete to authenticated using ((select auth.uid()) = user_id);

-- Table permissions. Supabase grants everything to anon and authenticated by
-- default; take that back. Logged-in users may read, add and delete rows (RLS
-- limits them to their own), and update only the listed columns: never the
-- ids or timestamps, so a row can't be moved to another user or budget, and
-- never a period's dates, which come from getPeriod().
revoke all on public.budgets, public.income_sources, public.budget_periods from anon, authenticated;
grant select, insert, delete on public.budgets, public.income_sources, public.budget_periods to authenticated;

grant update (
  name, frequency, pay_day_1, pay_day_2, pay_weekday, opening_balance,
  carry_over, ask_on_payday, budget_model, needs_pct, wants_pct, savings_debt_pct
) on public.budgets to authenticated;

grant update (name, amount, amount_varies, pay_slot, start_date, end_date)
on public.income_sources to authenticated;

grant update (carried_in, leftover_choice, first_pay_received, closed_at)
on public.budget_periods to authenticated;
