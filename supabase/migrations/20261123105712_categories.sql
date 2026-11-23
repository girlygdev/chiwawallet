-- categories: per-user spending and income categories (mvp-brief.md data
-- model; Week 3, task 3a). Decisions: plan review 3.4 (option A) and 3.6.
-- The brief's `group` column is named `budget_group` here, because `group` is
-- a reserved word in SQL and every query would have to quote it (owner, Nov 23).

-- ---------------------------------------------------------------------------
-- The table
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  -- Filled in from the logged-in user, so the app never sends it.
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- 1-30 characters, like the New category form (more-and-categories.md §2).
  name text not null check (char_length(btrim(name)) between 1 and 30),
  kind text not null check (kind in ('income', 'expense')),
  -- The 50/30/20 group. Expense only; see categories_group_matches_kind.
  budget_group text check (budget_group in ('needs', 'wants', 'savings_debt')),
  -- A Lucide icon name, like 'shopping-basket'.
  icon text not null check (icon ~ '^[a-z0-9-]{1,40}$'),
  -- One of the six colours in more-and-categories.md §2.
  color text not null check (color in ('orange', 'blue', 'purple', 'yellow', 'red', 'green')),
  -- Optional budget per payday in centavos, copied into each period's plan.
  default_budget bigint check (default_budget > 0),
  -- Set only on the three locked system categories (plan review 3.4).
  system_key text check (system_key in ('income', 'savings_pot', 'extra_debt')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Expense categories need a group; income categories have none.
  -- coalesce(..., false): a check that comes out null would count as passing.
  constraint categories_group_matches_kind check (coalesce(
    case kind
      when 'expense' then budget_group is not null
      when 'income' then budget_group is null
    end,
    false
  )),

  -- Each system category has a fixed kind and group: Income is income;
  -- Savings pot and Extra debt payment are Savings & debt payoff expenses.
  constraint categories_system_key_shape check (
    system_key is null
    or (system_key = 'income' and kind = 'income')
    or (system_key in ('savings_pot', 'extra_debt') and kind = 'expense' and budget_group = 'savings_debt')
  ),

  -- Lets transactions and plan items require that a row and its category have
  -- the same owner (the same pattern as budgets).
  constraint categories_id_user_id_key unique (id, user_id)
);

-- Names are unique per user, ignoring case and outer spaces: "food " and
-- "Food" clash.
create unique index categories_user_name_key on public.categories (user_id, lower(btrim(name)));
-- Each system category once per user. Rows without a system_key (null) don't
-- clash with each other.
create unique index categories_user_system_key_key on public.categories (user_id, system_key);

create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- System categories can't be renamed or moved to another group. (They can't
-- be deleted either: see the delete policy below.) Their icon, colour and
-- default budget can still change.
-- ---------------------------------------------------------------------------
create function public.lock_system_categories()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.system_key is not null
    and (new.name is distinct from old.name or new.budget_group is distinct from old.budget_group)
  then
    raise exception '% is a system category and can''t be renamed or moved.', old.name
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger categories_lock_system
before update on public.categories
for each row execute function public.lock_system_categories();

-- ---------------------------------------------------------------------------
-- Row Level Security: each user can only see and change their own rows.
-- ---------------------------------------------------------------------------
alter table public.categories enable row level security;

create policy "Users can read their own categories" on public.categories
for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users can add their own categories" on public.categories
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users can update their own categories" on public.categories
for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- System rows are left out, so deleting one matches nothing. Deleting the
-- account still removes them: the cascade doesn't go through RLS.
create policy "Users can delete their own non-system categories" on public.categories
for delete to authenticated using ((select auth.uid()) = user_id and system_key is null);

-- Table permissions. Take back Supabase's default grants, then allow reading
-- and deleting (RLS limits both), adding with only the listed columns (never
-- system_key, so nobody can make a second "system" row), and updating only
-- the fields the Edit category form changes. kind can't change after creation,
-- so a category's past transactions keep their meaning.
revoke all on public.categories from anon, authenticated;
grant select, delete on public.categories to authenticated;
grant insert (name, kind, budget_group, icon, color, default_budget)
on public.categories to authenticated;
grant update (name, budget_group, icon, color, default_budget)
on public.categories to authenticated;

-- ---------------------------------------------------------------------------
-- Default categories (more-and-categories.md §4, icons and colours approved
-- Nov 23). One copy per user, which they can edit.
-- ---------------------------------------------------------------------------
create function public.add_default_categories(target_user uuid)
returns void
language plpgsql
-- Runs as the table owner: at sign-up the new user isn't logged in yet, and
-- system_key can't be written through the API. The empty search_path means
-- every name is written in full.
security definer
set search_path = ''
as $$
begin
  insert into public.categories (user_id, name, kind, budget_group, icon, color, system_key)
  values
    (target_user, 'Food',               'expense', 'needs',        'shopping-basket', 'green',  null),
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
    (target_user, 'Income',             'income',  null,           'wallet',          'green',  'income'),
    (target_user, 'Savings pot',        'expense', 'savings_debt', 'piggy-bank',      'green',  'savings_pot'),
    (target_user, 'Extra debt payment', 'expense', 'savings_debt', 'credit-card',     'red',    'extra_debt')
  -- Skips any category the user already has (same name or system key), so
  -- running it twice is harmless.
  on conflict do nothing;
end;
$$;

-- Only handle_new_user() and this migration should run it.
revoke execute on function public.add_default_categories(uuid) from public, anon, authenticated;

-- handle_new_user() again, unchanged from the profiles migration except for
-- the last line, which now also adds the default categories. If adding them
-- fails, the sign-up fails too, so a user is never left without categories.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name, consent_at, consent_version)
  values (
    new.id,
    -- The sign-up form sends a trimmed name of up to 40 characters, but
    -- anyone can call the sign-up API directly, so clean it here too rather
    -- than let a bad value block the sign-up.
    nullif(left(btrim(new.raw_user_meta_data ->> 'display_name'), 40), ''),
    -- The sign-up form only sends consent_at when the box is ticked. Record
    -- the database's own time instead of trusting the value sent.
    case when new.raw_user_meta_data ? 'consent_at' then now() end,
    -- Kept only with consent, and only if it looks like a version date;
    -- anything else is dropped instead of blocking the sign-up.
    case
      when new.raw_user_meta_data ? 'consent_at'
        and new.raw_user_meta_data ->> 'consent_version' ~ '^\d{4}-\d{2}-\d{2}$'
      then new.raw_user_meta_data ->> 'consent_version'
    end
  );

  perform public.add_default_categories(new.id);
  return new;
end;
$$;

-- create or replace keeps the earlier revoke, but say it again to be sure.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Default categories for accounts made before this migration.
select public.add_default_categories(id) from auth.users;
