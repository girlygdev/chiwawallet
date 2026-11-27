-- Credit cards (owner, Nov 27; Week 8 task 8b-1). A card is a revolving
-- debt: its balance goes up with every purchase made with it and down with
-- every payment. Nothing about it is stored except its starting balance:
--   card balance = total_amount (the balance when added) + charges − payments
-- - Charges are expenses with `card_id`: spending (budgets, 50/30/20), but
--   no cash leaves.
-- - Payments are debt payments to the card; the database fills in their
--   `card_id` too: cash leaves, but it isn't spending again.
-- Existing debts and transactions are unchanged.

-- ---------------------------------------------------------------------------
-- 1. debts: a fourth payment type, 'card'
-- ---------------------------------------------------------------------------
alter table public.debts drop constraint debts_payment_type_check;
alter table public.debts
  add constraint debts_payment_type_check check (payment_type in ('installments', 'one_time', 'flexible', 'card'));

-- A card can be added with nothing owed yet; other debts still need an amount.
alter table public.debts drop constraint debts_total_amount_check;
alter table public.debts
  add constraint debts_total_amount_check check (total_amount > 0 or (payment_type = 'card' and total_amount = 0));

-- When the card's payment is due each month, and which payday pays it (the
-- same choices as a pot; a bill's "split" isn't offered).
alter table public.debts
  add column due_day smallint check (due_day between 1 and 31),
  add column pay_slot text check (pay_slot in ('payday_1', 'payday_2', 'every'));

-- Each type's fields, replacing the check from the flexible debts migration.
-- The three earlier types are as before, plus: no due day or payday.
-- A card has no schedule or target month, and needs a due day and a payday.
alter table public.debts drop constraint debts_payments_match_type;
alter table public.debts add constraint debts_payments_match_type check (coalesce(
  case payment_type
    when 'installments' then
      num_payments between 2 and 60
      and payment_amount is not null
      and first_due_date is not null
      and target_date is null
      and due_day is null and pay_slot is null
    when 'one_time' then
      num_payments = 1
      and payment_amount = total_amount
      and first_due_date is not null
      and target_date is null
      and due_day is null and pay_slot is null
    when 'flexible' then
      num_payments is null
      and payment_amount is null
      and first_due_date is null
      and due_day is null and pay_slot is null
    when 'card' then
      num_payments is null
      and payment_amount is null
      and first_due_date is null
      and target_date is null
      and due_day is not null and pay_slot is not null
  end,
  false
));

-- A card stays a card, and nothing else becomes one: its charges only make
-- sense on a card, and a loan's payments aren't charges.
create or replace function public.keep_card_type()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (old.payment_type = 'card') <> (new.payment_type = 'card') then
    raise exception 'A credit card can''t change to another kind of debt, or the other way round.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger debts_keep_card_type
before update of payment_type on public.debts
for each row execute function public.keep_card_type();

grant update (due_day, pay_slot) on public.debts to authenticated;

-- ---------------------------------------------------------------------------
-- 2. transactions.card_id
-- ---------------------------------------------------------------------------
-- "no action": a card with charges or payments can't be deleted (its past
-- purchases would turn into cash spending); the app closes it instead.
alter table public.transactions
  add column card_id uuid,
  add constraint transactions_card_only_on_expenses_and_payments
    check (card_id is null or type in ('expense', 'debt_payment')),
  -- A payment's card is the debt it pays.
  add constraint transactions_card_is_the_debt
    check (card_id is null or type <> 'debt_payment' or card_id = debt_id),
  add constraint transactions_card_fkey
    foreign key (card_id, user_id) references public.debts (id, user_id);

create index transactions_card_idx on public.transactions (card_id, user_id) where card_id is not null;

-- check_transaction_links() again (last changed in the savings pots and
-- debts migration), with two more steps:
-- 5. A payment to a card gets the card in `card_id`, so the money math can
--    tell it apart from spending without looking up the debt.
-- 6. `card_id` may only point to a card.
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

-- Runs when card_id changes too.
drop trigger transactions_check_links on public.transactions;
create trigger transactions_check_links
before insert or update of period_id, category_id, type, date, amount, pot_id, debt_id, card_id on public.transactions
for each row execute function public.check_transaction_links();

grant insert (card_id) on public.transactions to authenticated;
grant update (card_id) on public.transactions to authenticated;
