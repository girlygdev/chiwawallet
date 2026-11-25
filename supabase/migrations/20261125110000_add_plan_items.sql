-- add_plan_items(): adds a period's generated items, skipping any already
-- there (week-5-tasks.md 5c). generatePlan() in src/lib/plan.ts decides the
-- items; this only inserts them.
--
-- Why a function: the generation keys on plan_items are partial unique
-- indexes (20261125100000_plan_items.sql). The API's upsert can only skip
-- duplicates of the primary key, but SQL's bare "on conflict do nothing"
-- skips a duplicate of any of them. So opening a period twice, or from two
-- tabs at once, adds nothing the second time, and an item you deleted never
-- comes back (the keys count deleted rows).

create function public.add_plan_items(target_period uuid, items jsonb)
-- How many items were added.
returns integer
language plpgsql
-- Runs as the caller: RLS, the column permissions, the checks and the
-- same-owner foreign keys apply exactly as to an insert from the app. Another
-- user's period or source is refused by the foreign keys.
security invoker
set search_path = ''
as $$
declare
  added integer;
begin
  -- Always `recurring`: this is only for generated items. One-offs, the
  -- starter plan and assigned items are added with a plain insert.
  insert into public.plan_items
    (period_id, name, category_id, planned_amount, origin, income_source_id, bill_id, pot_id, debt_id)
  select
    target_period, i.name, i.category_id, i.planned_amount, 'recurring',
    i.income_source_id, i.bill_id, i.pot_id, i.debt_id
  from jsonb_to_recordset(items) as i(
    name text,
    category_id uuid,
    planned_amount bigint,
    income_source_id uuid,
    bill_id uuid,
    pot_id uuid,
    debt_id uuid
  )
  on conflict do nothing;

  get diagnostics added = row_count;
  return added;
end;
$$;

-- Logged-in users only.
revoke execute on function public.add_plan_items(uuid, jsonb) from public, anon;
grant execute on function public.add_plan_items(uuid, jsonb) to authenticated;
