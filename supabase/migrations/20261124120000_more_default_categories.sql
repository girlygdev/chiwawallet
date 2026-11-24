-- More default categories (owner, Nov 24):
-- - Needs: Groceries and Market are new, and Food becomes Meals (utensils
--   icon), so the three don't overlap.
-- - Wants: Subscriptions is new.
-- - Emergency Fund and Sinking Funds are left out: they hold a balance, so
--   they become default savings pots in Week 4, not categories.
-- New sign-ups get 18 categories (15 plus the 3 system ones).

-- ---------------------------------------------------------------------------
-- New sign-ups: the full list again, unchanged except for the lines marked.
-- ---------------------------------------------------------------------------
create or replace function public.add_default_categories(target_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.categories (user_id, name, kind, budget_group, icon, color, system_key)
  values
    (target_user, 'Meals',              'expense', 'needs',        'utensils',        'green',  null), -- was Food
    (target_user, 'Groceries',          'expense', 'needs',        'shopping-cart',   'green',  null), -- new
    (target_user, 'Market',             'expense', 'needs',        'store',           'orange', null), -- new
    (target_user, 'Transport',          'expense', 'needs',        'car',             'blue',   null),
    (target_user, 'Bills',              'expense', 'needs',        'zap',             'yellow', null),
    (target_user, 'Rent',               'expense', 'needs',        'house',           'orange', null),
    (target_user, 'Load & data',        'expense', 'needs',        'wifi',            'blue',   null),
    (target_user, 'Health',             'expense', 'needs',        'heart-pulse',     'red',    null),
    (target_user, 'Padala',             'expense', 'needs',        'smartphone',      'purple', null),
    (target_user, 'Personal',           'expense', 'wants',        'scissors',        'purple', null),
    (target_user, 'Shopping',           'expense', 'wants',        'shirt',           'orange', null),
    (target_user, 'Dining out',         'expense', 'wants',        'coffee',          'yellow', null),
    (target_user, 'Fun',                'expense', 'wants',        'gamepad-2',       'purple', null),
    (target_user, 'Gifts',              'expense', 'wants',        'gift',            'red',    null),
    (target_user, 'Travel',             'expense', 'wants',        'plane',           'blue',   null),
    (target_user, 'Subscriptions',      'expense', 'wants',        'tv',              'purple', null), -- new
    (target_user, 'Income',             'income',  null,           'wallet',          'green',  'income'),
    (target_user, 'Savings pot',        'expense', 'savings_debt', 'piggy-bank',      'green',  'savings_pot'),
    (target_user, 'Extra debt payment', 'expense', 'savings_debt', 'credit-card',     'red',    'extra_debt')
  -- Skips any category the user already has (same name or system key).
  on conflict do nothing;
end;
$$;

-- create or replace keeps the earlier revoke, but say it again to be sure.
revoke execute on function public.add_default_categories(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Existing accounts. Not add_default_categories(): that would bring back
-- defaults someone deleted on purpose.
-- ---------------------------------------------------------------------------

-- 1. Food → Meals, only where it's still called Food and Meals isn't taken.
--    The icon changes only if it's still the default basket (Groceries gets
--    a cart). Its transactions keep their category, now named Meals.
update public.categories c
set name = 'Meals',
    icon = case when c.icon = 'shopping-basket' then 'utensils' else c.icon end
where c.name = 'Food'
  and c.system_key is null
  and not exists (
    select 1 from public.categories m
    where m.user_id = c.user_id and lower(btrim(m.name)) = 'meals'
  );

-- 2. The three new categories, skipping any name an account already has.
insert into public.categories (user_id, name, kind, budget_group, icon, color)
select u.id, v.name, 'expense', v.budget_group, v.icon, v.color
from auth.users u
cross join (values
  ('Groceries',     'needs', 'shopping-cart', 'green'),
  ('Market',        'needs', 'store',         'orange'),
  ('Subscriptions', 'wants', 'tv',            'purple')
) as v(name, budget_group, icon, color)
on conflict do nothing;
