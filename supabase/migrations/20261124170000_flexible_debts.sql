-- Flexible debts: "When I can" (owner, Nov 24). A third way to pay a debt,
-- for money owed with no schedule (family, friends): pay whenever there's
-- extra. It has a total but no number of payments, payment amount or due
-- date, so those become optional, and it can have an optional target month
-- ("Aim to pay off by"). Every payment on it counts as an extra payment
-- (Savings & debt payoff). Existing debts are unchanged.

-- A third payment type.
alter table public.debts drop constraint debts_payment_type_check;
alter table public.debts
  add constraint debts_payment_type_check check (payment_type in ('installments', 'one_time', 'flexible'));

-- Only installments and one-time debts have a schedule.
alter table public.debts
  alter column num_payments drop not null,
  alter column payment_amount drop not null,
  alter column first_due_date drop not null;

-- "Aim to pay off by" (optional), stored as the 1st of the month, like a
-- pot's target date. Flexible debts only.
alter table public.debts
  add column target_date date check (target_date is null or extract(day from target_date) = 1);

-- Each type's fields, replacing the earlier check:
-- - installments: 2-60 payments, a payment amount and a first due date.
-- - one_time: one payment of the full amount on a due date.
-- - flexible: no schedule at all; only it may have a target month.
-- coalesce(..., false): a check that comes out null would count as passing.
alter table public.debts drop constraint debts_payments_match_type;
alter table public.debts add constraint debts_payments_match_type check (coalesce(
  case payment_type
    when 'installments' then
      num_payments between 2 and 60
      and payment_amount is not null
      and first_due_date is not null
      and target_date is null
    when 'one_time' then
      num_payments = 1
      and payment_amount = total_amount
      and first_due_date is not null
      and target_date is null
    when 'flexible' then
      num_payments is null
      and payment_amount is null
      and first_due_date is null
  end,
  false
));

-- The Edit debt form may set the target month too.
grant update (target_date) on public.debts to authenticated;
