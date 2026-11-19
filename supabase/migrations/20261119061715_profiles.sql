-- profiles: one row per user for name, consent and settings (mvp-brief.md data model).
-- Created automatically on sign-up by a trigger on auth.users.

-- Shared by every table: keeps updated_at current on each update.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  -- Deleting the account deletes the profile.
  user_id uuid not null unique references auth.users (id) on delete cascade,
  -- Empty for Google sign-ups until they finish the consent step.
  display_name text check (char_length(display_name) between 1 and 40),
  week_start text not null default 'monday' check (week_start in ('monday', 'sunday')),
  -- The Data Privacy Act consent record. Empty until the user agrees.
  consent_at timestamptz,
  -- Which Privacy Notice and Terms the user agreed to: their "Last updated"
  -- date, like '2026-11-14' (legal.md, decided Nov 19). Set with consent_at.
  consent_version text check (consent_version ~ '^\d{4}-\d{2}-\d{2}$'),
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  bill_reminders boolean not null default true,
  payday_summary boolean not null default true,
  mid_period_checkin boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Row Level Security: each user can only see and change their own profile.
alter table public.profiles enable row level security;

create policy "Users can read their own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- No insert or delete policies: the trigger below creates profiles, and
-- deleting the account removes them.

-- Column permissions (decided Nov 19). Supabase grants everything on new tables
-- to anon and authenticated; take that back, then allow reading and updating
-- only the fields users may change. is_demo, consent_at, consent_version,
-- user_id, id and the timestamps can't be changed through the API, even on
-- your own row.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, week_start, theme, bill_reminders, payday_summary, mid_period_checkin)
on public.profiles to authenticated;

-- Creates the profile when someone signs up. Runs as the table owner
-- (security definer) because the new user isn't logged in yet and has no
-- insert permission. The empty search_path means every name must be written
-- in full (public.profiles), so nobody can swap in a look-alike table.
create function public.handle_new_user()
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
  return new;
end;
$$;

-- Only the trigger should run it.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Profiles for accounts made before this migration. Their consent_at was
-- written by our own server code, so it's copied as is. They have no
-- consent_version: they agreed before versions were recorded.
insert into public.profiles (user_id, display_name, consent_at)
select
  id,
  nullif(left(btrim(raw_user_meta_data ->> 'display_name'), 40), ''),
  (raw_user_meta_data ->> 'consent_at')::timestamptz
from auth.users
on conflict (user_id) do nothing;
