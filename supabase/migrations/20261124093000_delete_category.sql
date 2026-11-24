-- delete_category(): the level 2 category delete (delete-pattern.md §4,
-- "Category"; week-3-tasks.md 3h-2). A category with transactions can't be
-- deleted (transactions_category_fkey), so its transactions move to another
-- category first. Both steps run in one function call, which Postgres runs as
-- one transaction: if the delete fails, the move is undone too (§6).
-- Week 5 adds plan_items to the move.

create function public.delete_category(target_category uuid, move_to uuid default null)
-- How many transactions moved (soft-deleted ones included).
returns integer
language plpgsql
-- Runs as the caller, so RLS and the column grants apply to every step: users
-- can only move and delete their own rows, and system categories can't be
-- deleted (the delete policy skips them).
security invoker
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  target public.categories%rowtype;
  destination public.categories%rowtype;
  moved integer := 0;
begin
  select * into target from public.categories where id = target_category and user_id = me;
  if not found then
    -- Missing, already deleted, or someone else's (RLS hides it).
    raise exception 'That category no longer exists.' using errcode = 'P0002';
  end if;
  if target.system_key is not null then
    raise exception '% is a system category and can''t be deleted.', target.name using errcode = '42501';
  end if;

  -- Soft-deleted rows count too: they still point at the category, and Undo
  -- brings them back.
  if exists (select 1 from public.transactions where category_id = target.id and user_id = me) then
    select * into destination from public.categories where id = move_to and user_id = me;
    -- The same kind keeps check_transaction_links() happy; system categories
    -- are only for pot transfers and extra debt payments.
    if not found or destination.id = target.id or destination.system_key is not null
      or destination.kind <> target.kind
    then
      raise exception 'Pick another category to move its transactions to.' using errcode = '22023';
    end if;

    update public.transactions set category_id = destination.id
    where category_id = target.id and user_id = me;
    get diagnostics moved = row_count;
  end if;

  delete from public.categories where id = target.id and user_id = me;
  return moved;
end;
$$;

-- Logged-in users only.
revoke execute on function public.delete_category(uuid, uuid) from public, anon;
grant execute on function public.delete_category(uuid, uuid) to authenticated;
