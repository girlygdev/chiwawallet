-- Starting the next period early (owner, Nov 28; Task D1). Pay that arrives
-- before payday (holidays, weekends) can start the next period on the day
-- you choose to, so spending from then on comes out of the new money:
-- - budget_periods.started_early_on: the day a period actually began, up to
--   5 days before its payday. start_date stays the payday, because the plan
--   math (bills, due dates, pay) keys on it.
-- - The period before it ends the day before (its end_date moves).
-- - start_period_early() is the only way to do it: it uses the database's
--   clock (today in Manila), checks everything, and moves the old period's
--   transactions dated from today into the new period, all at once.
-- Owner decisions: no undo (D, Nov 28); the leftover is handled by the
-- payday screen as on a normal payday (D3).

-- ---------------------------------------------------------------------------
-- 1. The column
-- ---------------------------------------------------------------------------
alter table public.budget_periods
  add column started_early_on date,
  -- Up to 5 days before the payday (EARLY_PAY_DAYS in lib/income.ts), never on or after it.
  add constraint budget_periods_started_early_window check (
    started_early_on is null or (started_early_on < start_date and started_early_on >= start_date - 5)
  );

-- Not written by the app directly: there's no update grant for it, and an
-- insert that sets it is refused. start_period_early() sets it.
create function public.refuse_started_early_on_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.started_early_on is not null then
    raise exception 'Use start_period_early() to start a period early.' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger budget_periods_refuse_started_early_on
before insert on public.budget_periods
for each row execute function public.refuse_started_early_on_insert();

-- ---------------------------------------------------------------------------
-- 2. check_transaction_links(): a period's dates begin on started_early_on
-- ---------------------------------------------------------------------------
-- As in 20261127100000_credit_cards.sql, with one change in the first step:
-- the period runs from coalesce(started_early_on, start_date). Its end_date
-- is already its real last day (start_period_early() moves it).
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
  debt_type text;
begin
  select coalesce(started_early_on, start_date), end_date into period_start, period_end
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

  -- 5. A payment to a card is marked as one.
  if new.type = 'debt_payment' and new.debt_id is not null then
    select payment_type into debt_type
    from public.debts
    where id = new.debt_id and user_id = new.user_id;
    if debt_type = 'card' then
      new.card_id := new.debt_id;
    end if;
  end if;

  -- 6. Only a card can be charged or paid as one.
  if new.card_id is not null then
    select payment_type into debt_type
    from public.debts
    where id = new.card_id and user_id = new.user_id;
    if debt_type is distinct from 'card' then
      raise exception 'That debt isn''t a credit card.' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. start_period_early(): start `target_period` today
-- ---------------------------------------------------------------------------
-- Refused, with codes the app turns into messages:
--   42501  not logged in
--   P0002  not there: missing or another user's, or no period right before it
--   22023  not allowed: more than 5 days before its payday, on or after it,
--          or the period before it began today (it would have no days)
--   55000  not now: already started early, or either period is closed
create function public.start_period_early(target_period uuid)
returns void
language plpgsql
-- Runs as the table owner so it can move end_date and set started_early_on,
-- which users can't write. It only ever touches the caller's own rows
-- (auth.uid()), and the empty search_path means every name is written in full.
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  -- The database's clock, not one sent by the browser.
  today date := (now() at time zone 'Asia/Manila')::date;
  target public.budget_periods;
  previous public.budget_periods;
begin
  if caller is null then
    raise exception 'Log in to start a period.' using errcode = '42501';
  end if;

  -- Both rows locked until this transaction ends, so two taps can't race.
  select * into target from public.budget_periods
  where id = target_period and user_id = caller
  for update;
  if not found then
    raise exception 'That period isn''t there.' using errcode = 'P0002';
  end if;
  -- Before looking for the period before: starting moved its end_date, so
  -- a second try wouldn't find it.
  if target.started_early_on is not null then
    raise exception 'This period already started early.' using errcode = '55000';
  end if;

  select * into previous from public.budget_periods
  where budget_id = target.budget_id and user_id = caller and end_date = target.start_date - 1
  for update;
  if not found then
    raise exception 'There''s no period right before this one.' using errcode = 'P0002';
  end if;

  if target.closed_at is not null or previous.closed_at is not null then
    raise exception 'That period is closed.' using errcode = '55000';
  end if;
  if today >= target.start_date or today < target.start_date - 5 then
    raise exception 'A period can start early only in the 5 days before its payday.' using errcode = '22023';
  end if;
  if today <= previous.start_date then
    raise exception 'The period before it would have no days left.' using errcode = '22023';
  end if;

  -- Order matters for check_transaction_links(): open the new period's
  -- early days first, then move the rows, then end the old period.
  update public.budget_periods set started_early_on = today where id = target.id;

  update public.transactions
  set period_id = target.id
  where period_id = previous.id and user_id = caller and date >= today;

  update public.budget_periods set end_date = today - 1 where id = previous.id;
end;
$$;

-- Logged-in users only.
revoke execute on function public.start_period_early(uuid) from public, anon;
grant execute on function public.start_period_early(uuid) to authenticated;
