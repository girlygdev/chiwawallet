-- Set a budget, "This period only" (week-5-tasks.md 5g-1): the app inserts a
-- spending budget for one period already marked `edited`, so 5h's sync never
-- changes it to the category's budget per payday. One write instead of an
-- insert and then an update, which could leave it half-saved.
-- Updating `edited` was already allowed (5a); this adds it to inserts.
grant insert (edited) on public.plan_items to authenticated;
