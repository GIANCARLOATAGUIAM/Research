-- WUPCare 0003: role helpers, audit stamps, health record and profile triggers.
-- Spec: SYSTEM_SPEC.md §9.4, §10.1, §4.9 (FR-USR-4).
--
-- All functions: fixed empty search_path, fully qualified names.
-- Postgres grants EXECUTE to PUBLIC by default, and this project's default
-- privileges also grant it to anon and authenticated, so every function
-- here has EXECUTE revoked and re-granted only where needed.

-- ---------------------------------------------------------------------------
-- Role lookups used by RLS policies and by the RPC functions.
-- SECURITY DEFINER so they can read profiles without recursing into the
-- profiles RLS policies. Inactive or missing profiles return null, so every
-- policy that compares the result denies them.
-- ---------------------------------------------------------------------------
create function private.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active;
$$;

create function private.current_student_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.student_id
  from public.profiles p
  where p.id = (select auth.uid())
    and p.is_active
    and p.role = 'student';
$$;

-- Raises insufficient_privilege unless the caller is active and has one of
-- the given roles. Used at the top of every SECURITY DEFINER RPC.
create function private.require_role(variadic p_roles public.user_role[])
returns public.user_role
language plpgsql
stable
set search_path = ''
as $$
declare
  v_role public.user_role := private.current_user_role();
begin
  if v_role is null or not (v_role = any (p_roles)) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;
  return v_role;
end;
$$;

-- The clinic's calendar date. All "today" logic uses Philippine time.
create function private.manila_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Manila')::date;
$$;

revoke all on function private.current_user_role() from public, anon;
revoke all on function private.current_student_id() from public, anon;
revoke all on function private.require_role(public.user_role[]) from public, anon, authenticated;
revoke all on function private.manila_today() from public, anon;
-- RLS policies run as the caller, so the caller needs EXECUTE on these two.
grant execute on function private.current_user_role() to authenticated;
grant execute on function private.current_student_id() to authenticated;
grant execute on function private.manila_today() to authenticated;

-- ---------------------------------------------------------------------------
-- updated_at / updated_by stamp. Applied to every editable table.
-- For service-role or SQL-editor writes (no JWT), updated_by keeps whatever
-- value the statement supplied.
-- ---------------------------------------------------------------------------
create function private.stamp_updated()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  return new;
end;
$$;

revoke all on function private.stamp_updated() from public, anon, authenticated;

create trigger stamp_updated before update on public.profiles
  for each row execute function private.stamp_updated();
create trigger stamp_updated before update on public.students
  for each row execute function private.stamp_updated();
create trigger stamp_updated before update on public.health_records
  for each row execute function private.stamp_updated();
create trigger stamp_updated before update on public.appointments
  for each row execute function private.stamp_updated();
create trigger stamp_updated before update on public.clinic_visits
  for each row execute function private.stamp_updated();
create trigger stamp_updated before update on public.health_incidents
  for each row execute function private.stamp_updated();
create trigger stamp_updated before update on public.clinic_settings
  for each row execute function private.stamp_updated();
create trigger stamp_updated before update on public.medicines
  for each row execute function private.stamp_updated();

-- ---------------------------------------------------------------------------
-- Empty health record for every new student (FR-HR-2).
-- SECURITY DEFINER so clinic staff need no INSERT right on health_records.
-- ---------------------------------------------------------------------------
create function private.create_health_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.health_records (student_id) values (new.id);
  return null;
end;
$$;

revoke all on function private.create_health_record() from public, anon, authenticated;

create trigger create_health_record after insert on public.students
  for each row execute function private.create_health_record();

-- ---------------------------------------------------------------------------
-- An administrator cannot deactivate or change the role of their own
-- account (FR-USR-4). Also blocks every non-admin from changing role,
-- activation, or student link, even if a grant were added by mistake.
-- Writes with no JWT (service role, SQL editor) are not restricted here;
-- the server action must enforce FR-USR-4 itself when it uses them.
-- ---------------------------------------------------------------------------
create function private.guard_profile_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.is_active is distinct from old.is_active
     or new.student_id is distinct from old.student_id then
    if private.current_user_role() is distinct from 'admin' then
      raise exception 'Only an administrator can change roles, access, or student links.'
        using errcode = '42501';
    end if;
    if old.id = v_uid then
      raise exception 'You cannot change the role or access of your own account.'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.guard_profile_update() from public, anon, authenticated;

create trigger guard_profile_update before update on public.profiles
  for each row execute function private.guard_profile_update();

-- ---------------------------------------------------------------------------
-- Account provisioning (spec §8.8).
-- The server action creates the auth user with the service-role key and
-- passes app_metadata { wupcare_role, full_name, student_id }. app_metadata
-- can only be set with the service-role key, never by the user. This
-- trigger creates the profile in the same transaction, so a bad role or an
-- already-linked student makes the whole createUser call fail: no orphaned
-- auth user without a profile.
-- Users created without wupcare_role (for example from the dashboard) get
-- no profile and are blocked by the app until one is added.
-- ---------------------------------------------------------------------------
create function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meta jsonb := coalesce(new.raw_app_meta_data, '{}'::jsonb);
begin
  if v_meta ? 'wupcare_role' then
    insert into public.profiles (id, full_name, email, role, student_id)
    values (
      new.id,
      coalesce(nullif(btrim(v_meta ->> 'full_name'), ''), new.email),
      coalesce(new.email, ''),
      (v_meta ->> 'wupcare_role')::public.user_role,
      nullif(v_meta ->> 'student_id', '')::uuid
    );
  end if;
  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_auth_user();
