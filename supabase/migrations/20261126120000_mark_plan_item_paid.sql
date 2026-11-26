-- Mark paid (week-6-tasks.md 6a): ticking a plan item creates the matching
-- transaction and sets the item's paid_at, together, so one never happens
-- without the other. Undo soft-deletes that transaction, and a trigger
-- un-ticks the item; restoring the transaction ticks it again.

-- ---------------------------------------------------------------------------
-- 1. Permissions: the app can now set paid_at (through the function and the
-- trigger below) and link a transaction to the plan item it paid.
-- ---------------------------------------------------------------------------
grant update (paid_at) on public.plan_items to authenticated;
grant insert (plan_item_id) on public.transactions to authenticated;

-- ---------------------------------------------------------------------------
-- 2. mark_plan_item_paid(): pays one item and returns the new transaction's
-- id (for Undo). The transaction follows the item:
--   pot (scheduled or assigned)  savings deposit to that pot
--   debt (scheduled or extra)    debt payment on that debt
--   bill or one-off              expense
-- always in the item's own category (Bills, Savings pot, Debt payment, Extra
-- debt payment, Gifts…). Refused, with codes the app turns into messages:
--   P0002  not there: missing, removed, or another user's (RLS hides it)
--   22023  can't be ticked: income (that's I got paid), spending budgets and
--          starter lines (measured by spending), or an amount of ₱0 or less
--   55000  not now: already paid, or its period is closed
-- A date outside the period is refused by check_transaction_links() (23514).
-- ---------------------------------------------------------------------------
create function public.mark_plan_item_paid(target_item uuid, paid_on date, paid_amount bigint)
returns uuid
language plpgsql
-- Runs as the caller: RLS, the column permissions, the checks and the
-- same-owner foreign keys apply exactly as to inserts and updates from the app.
security invoker
set search_path = ''
as $$
declare
  item public.plan_items;
  period_closed timestamptz;
  new_type text;
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

  insert into public.transactions (period_id, category_id, type, amount, date, pot_id, debt_id, plan_item_id)
  values (item.period_id, item.category_id, new_type, paid_amount, paid_on, item.pot_id, item.debt_id, item.id)
  returning id into new_id;

  update public.plan_items set paid_at = now() where id = item.id;
  return new_id;
end;
$$;

-- Logged-in users only.
revoke execute on function public.mark_plan_item_paid(uuid, date, bigint) from public, anon;
grant execute on function public.mark_plan_item_paid(uuid, date, bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. paid_at follows the payment (delete-pattern.md: deleting a transaction
-- that paid a plan item makes it due again). Soft-deleting the payment
-- clears paid_at, unless another live payment still covers the item;
-- restoring it (Undo) sets paid_at again. Runs as the caller, like the rest.
-- ---------------------------------------------------------------------------
create function public.sync_plan_item_paid()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.plan_item_id is null then
    return new;
  end if;

  if old.deleted_at is null and new.deleted_at is not null then
    update public.plan_items
    set paid_at = null
    where id = new.plan_item_id
      and user_id = new.user_id
      and not exists (
        select 1 from public.transactions t
        where t.plan_item_id = new.plan_item_id and t.deleted_at is null and t.id <> new.id
      );
  elsif old.deleted_at is not null and new.deleted_at is null then
    update public.plan_items
    set paid_at = coalesce(paid_at, now())
    where id = new.plan_item_id and user_id = new.user_id;
  end if;
  return new;
end;
$$;

create trigger transactions_sync_plan_item_paid
after update of deleted_at on public.transactions
for each row execute function public.sync_plan_item_paid();
