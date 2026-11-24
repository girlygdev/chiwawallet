-- delete_pot(): the level 2 savings pot delete (delete-pattern.md §4;
-- week-4-tasks.md 4d-3). The pot's money either moves to another pot or
-- counts as withdrawn, then the pot is deleted, all in one call, which
-- Postgres runs as one transaction: nothing is half done.
--
-- A balance is never stored (mvp-brief.md), so moving it means writing it
-- down as transactions in the given period:
-- - move:     a withdrawal from this pot and the same deposit into the other
--             pot. Net ₱0 to cash; the other pot's balance goes up.
-- - withdraw: a withdrawal from this pot. It adds the money to this
--             period's cash ("Adds ₱6,000 to this period's money").
-- Then the pot is deleted. Its transactions stay in Activity, with only the
-- pot link emptied (on delete set null, plan review 3.6).
-- Week 5 also removes the pot's future plan items here.

create function public.delete_pot(
  target_pot uuid,
  -- The period and day the move or withdrawal is written in (today).
  on_period uuid,
  on_date date,
  -- "move" or "withdraw"; only needed when the pot has money in it.
  choice text default null,
  -- The pot to move it to, for "move".
  move_to uuid default null
)
-- The amount moved or withdrawn (0 when the pot was empty).
returns bigint
language plpgsql
-- Runs as the caller, so RLS, the column grants and check_transaction_links()
-- (date inside the period, same owner) apply to every step.
security invoker
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  pot public.savings_pots%rowtype;
  destination public.savings_pots%rowtype;
  balance bigint;
  savings_category uuid;
begin
  select * into pot from public.savings_pots where id = target_pot and user_id = me;
  if not found then
    -- Missing, already deleted, or someone else's (RLS hides it).
    raise exception 'That pot no longer exists.' using errcode = 'P0002';
  end if;

  -- Starting balance + deposits − withdrawals, like potBalance() in the app.
  select pot.starting_balance + coalesce(sum(t.amount), 0) into balance
  from public.transactions t
  where t.pot_id = pot.id and t.user_id = me and t.deleted_at is null;

  if balance > 0 then
    if choice is null or choice not in ('move', 'withdraw') then
      raise exception 'Choose what happens to the money in %.', pot.name using errcode = '22023';
    end if;

    if choice = 'move' then
      select * into destination from public.savings_pots where id = move_to and user_id = me;
      if not found or destination.id = pot.id then
        raise exception 'Pick another pot to move the money to.' using errcode = '22023';
      end if;
    end if;

    -- The system Savings pot category, which every account has.
    select id into savings_category
    from public.categories
    where user_id = me and system_key = 'savings_pot';

    -- A locked pot refuses withdrawals (check_transaction_links). The app
    -- only offers this after "The money really left this pot", so unlock it
    -- first; the pot is deleted a moment later anyway.
    if pot.is_locked then
      update public.savings_pots set is_locked = false where id = pot.id and user_id = me;
    end if;

    insert into public.transactions (period_id, category_id, type, amount, date, note, pot_id)
    values (
      on_period, savings_category, 'savings', -balance, on_date,
      case when choice = 'move' then 'Moved to ' || destination.name else pot.name || ' closed' end,
      pot.id
    );

    if choice = 'move' then
      insert into public.transactions (period_id, category_id, type, amount, date, note, pot_id)
      values (on_period, savings_category, 'savings', balance, on_date, 'Moved from ' || pot.name, destination.id);
    end if;
  end if;

  delete from public.savings_pots where id = pot.id and user_id = me;
  return greatest(balance, 0);
end;
$$;

-- Logged-in users only.
revoke execute on function public.delete_pot(uuid, uuid, date, text, uuid) from public, anon;
grant execute on function public.delete_pot(uuid, uuid, date, text, uuid) to authenticated;
