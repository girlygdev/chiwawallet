-- A plan item's payment is named after the item (owner, Nov 28). Paying
-- "Mama Hair Treatment" (Personal) showed in Activity as just "Personal",
-- because mark_plan_item_paid() left the note empty and Activity names a row
-- by its note, falling back to the category. Now:
-- 1. mark_plan_item_paid() saves the item's name as the payment's note. Every
--    way of paying a plan item goes through it (Mark paid on the Plan, Bills
--    and Debts; savings and debt payments from the add sheet).
-- 2. Payments made before this get the same note, once, where it's empty.
-- Plan item names are at most 40 characters and notes up to 100, so it fits.

-- ---------------------------------------------------------------------------
-- 1. mark_plan_item_paid(): as in 20261128100000_bill_cards.sql, plus the note
-- ---------------------------------------------------------------------------
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

  -- The bill's card, if it has one (closing a card empties it).
  if item.bill_id is not null then
    select card_id into new_card from public.recurring_bills where id = item.bill_id and user_id = item.user_id;
  end if;

  -- New: note = the item's name, so Activity shows "Mama Hair Treatment · Personal".
  insert into public.transactions (period_id, category_id, type, amount, date, note, pot_id, debt_id, card_id, plan_item_id)
  values (item.period_id, item.category_id, new_type, paid_amount, paid_on, btrim(item.name), item.pot_id, item.debt_id, new_card, item.id)
  returning id into new_id;

  update public.plan_items set paid_at = now() where id = item.id;
  return new_id;
end;
$$;

-- create or replace keeps the grants, but say them again to be sure.
revoke execute on function public.mark_plan_item_paid(uuid, date, bigint) from public, anon;
grant execute on function public.mark_plan_item_paid(uuid, date, bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Earlier payments: the item's name where the note is still empty
-- ---------------------------------------------------------------------------
-- Same owner on both rows (the plan item link is an owner-tied foreign key);
-- a note someone already wrote is never replaced.
update public.transactions t
set note = btrim(p.name)
from public.plan_items p
where t.plan_item_id = p.id
  and t.user_id = p.user_id
  and t.note is null;
