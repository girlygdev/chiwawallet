-- record_consent: how the app records Privacy Notice and Terms consent after
-- sign-up (decided Nov 19, option a). Used by the one-time consent step for
-- Google sign-ups now, and for asking again when the notice changes later.
-- Users can't write consent_at or consent_version directly (column
-- permissions in the profiles migration), so this is the only way in.

create function public.record_consent(name text, version text)
returns void
language plpgsql
-- Runs as the table owner so it can write the protected columns. It only ever
-- touches the caller's own row (auth.uid()), and the empty search_path means
-- every table name is written in full.
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  clean_name text := nullif(btrim(name), '');
begin
  if caller is null then
    raise exception 'Log in to record consent.' using errcode = '42501';
  end if;
  -- The same rules as the consent form (Zod) and the profiles columns.
  if clean_name is null or char_length(clean_name) > 40 then
    raise exception 'Name must be 1 to 40 characters.' using errcode = '22023';
  end if;
  if version is null or version !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'Consent version must look like 2026-11-14.' using errcode = '22023';
  end if;

  -- The database's clock, not one sent by the browser.
  update public.profiles
  set display_name = clean_name,
      consent_at = now(),
      consent_version = version
  where user_id = caller;

  if not found then
    raise exception 'No profile for this user.' using errcode = 'P0002';
  end if;
end;
$$;

-- Supabase lets anon and authenticated run new functions by default. Only
-- logged-in users may call this one.
revoke execute on function public.record_consent(text, text) from public, anon;
grant execute on function public.record_consent(text, text) to authenticated;
