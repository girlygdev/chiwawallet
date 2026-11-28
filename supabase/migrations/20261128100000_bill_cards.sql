-- Bills paid with a credit card (owner, Nov 28). A bill can be charged
-- straight to a card, like Netflix or Spotify: Mark paid then records a card
-- charge (an expense with card_id, as in 8b-3), so the card's balance goes up
-- and cash stays the same. Owner decisions:
-- - Empty card_id = Cash, as before. Existing bills are unchanged.
-- - Closing a card (paid_off_at) or deleting it moves its bills back to Cash.
-- - Unpaid card bills don't count against Safe to spend, but still count in
--   Planned and their group (the app's money math, not the database).

-- ---------------------------------------------------------------------------
-- 1. recurring_bills.card_id
-- ---------------------------------------------------------------------------
alter table public.recurring_bills
  add column card_id uuid,
  -- Same owner. Deleting the card empties only this column: the bill stays
  -- and is paid in cash from then on.
  add constraint recurring_bills_card_fkey
    foreign key (card_id, user_id) references public.debts (id, user_id) on delete set null (card_id);

create index recurring_bills_card_idx on public.recurring_bills (card_id, user_id) where card_id is not null;

-- card_id must point to an open credit card. Runs as the caller: the
-- foreign key already makes it the caller's own debt, and someone else's id
-- finds nothing here and is refused.
create function public.check_bill_card()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  card public.debts;
begin
  if new.card_id is null then
    return new;
  end if;
  select * into card from public.debts where id = new.card_id and user_id = new.user_id;
  if not found or card.payment_type <> 'card' then
    raise exception 'A bill can only be paid with one of your credit cards.' using errcode = '23514';
  end if;
  if card.paid_off_at is not null then
    raise exception 'That card is closed.' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger recurring_bills_check_card
before insert or update of card_id on public.recurring_bills
for each row execute function public.check_bill_card();

grant update (card_id) on public.recurring_bills to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Closing a card moves its bills back to Cash
-- ---------------------------------------------------------------------------
-- Runs as the caller, so RLS limits it to their own bills (a card's bills are
-- always its owner's, by the foreign key). Reopening a card doesn't put them
-- back: pick the card again on the bill.
create function public.release_closed_card_bills()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.payment_type = 'card' and old.paid_off_at is null and new.paid_off_at is not null then
    update public.recurring_bills set card_id = null where card_id = new.id and user_id = new.user_id;
  end if;
  return new;
end;
$$;

create trigger debts_release_closed_card_bills
after update of paid_off_at on public.debts
for each row execute function public.release_closed_card_bills();

-- ---------------------------------------------------------------------------
-- 3. mark_plan_item_paid(): a bill on a card charges the card
-- ---------------------------------------------------------------------------
-- As in 20261126120000_mark_plan_item_paid.sql, with one change: a bill
-- item whose bill has a card gets that card in the payment's card_id. The
-- bill's card is read when it's paid, so changing the bill's card changes
-- how its next payment is made.
create or replace function public.mark_plan_item_paid(target_item uuid, paid_on date, paid_amount bigint)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  item public.plan_items;
  period_closed timestamptz;
  new_type text;
  new_card uuid;
  new_id uuid;
begin
  -- Locked until this transaction ends, so two taps can't pay it twice.
  select * into item
  from public.plan_items
  where id = target_item and deleted_at is null
  for update;
  if not found then
    raise exception 'That plan item isn''t there.' using errcode = 'P0002';
  end if;

  if item.income_source_id is not null
    or item.category_id is null
    or (item.origin = 'recurring' and item.bill_id is null and item.pot_id is null and item.debt_id is null)
  then
    raise exception 'This plan item isn''t ticked off.' using errcode = '22023';
  end if;
  if paid_amount is null or paid_amount <= 0 then
    raise exception 'The amount must be above 0.' using errcode = '22023';
  end if;

  if item.paid_at is not null then
    raise exception 'This plan item is already paid.' using errcode = '55000';
  end if;
  select closed_at into period_closed from public.budget_periods where id = item.period_id;
  if period_closed is not null then
    raise exception 'This period is closed.' using errcode = '55000';
  end if;

  new_type := case
    when item.pot_id is not null then 'savings'
    when item.debt_id is not null then 'debt_payment'
    else 'expense'
  end;

  -- New: the bill's card, if it has one (closing a card empties it).
  if item.bill_id is not null then
    select card_id into new_card from public.recurring_bills where id = item.bill_id and user_id = item.user_id;
  end if;

  insert into public.transactions (period_id, category_id, type, amount, date, pot_id, debt_id, card_id, plan_item_id)
  values (item.period_id, item.category_id, new_type, paid_amount, paid_on, item.pot_id, item.debt_id, new_card, item.id)
  returning id into new_id;

  update public.plan_items set paid_at = now() where id = item.id;
  return new_id;
end;
$$;

-- create or replace keeps the grants, but say them again to be sure.
revoke execute on function public.mark_plan_item_paid(uuid, date, bigint) from public, anon;
grant execute on function public.mark_plan_item_paid(uuid, date, bigint) to authenticated;
