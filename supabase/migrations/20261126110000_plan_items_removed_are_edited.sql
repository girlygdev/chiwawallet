-- Keeping open periods in sync (week-5-tasks.md 5h-1). From now on the sync
-- takes out generated items that no longer belong (a bill moved to the other
-- payday) with a soft delete, and brings them back if they belong again. It
-- tells its own removals apart from yours by `edited`: Remove from plan (5e)
-- now marks the item edited, so the sync never brings it back.
--
-- Until now nothing but you removed plan items, so every removed item was
-- removed by hand: mark them edited, once, so they stay removed.
update public.plan_items
set edited = true
where deleted_at is not null
  and not edited;
