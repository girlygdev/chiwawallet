-- Starting a period early re-dates its early pay (owner, Nov 28; Task D3).
-- Pay logged early is saved dated the payday (lib/income.ts earlyPay()).
-- Once the period starts, the money is being spent from that day, so
-- start_period_early() now moves that pay's date to today too, in the same
-- transaction as everything else.
--
-- As in 20261128110000_start_period_early.sql, with one more step at the end:
-- income in the new period dated after today, up to its payday, gets today's
-- date. Income dated after the payday isn't early pay and stays.

create or replace function public.start_period_early(target_period uuid)
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

  -- New: the early pay counts from today (D3).
  update public.transactions
  set date = today
  where period_id = target.id and user_id = caller and type = 'income'
    and date > today and date <= target.start_date;
end;
$$;

-- create or replace keeps the grants; restated so this file reads on its own.
revoke execute on function public.start_period_early(uuid) from public, anon;
grant execute on function public.start_period_early(uuid) to authenticated;
