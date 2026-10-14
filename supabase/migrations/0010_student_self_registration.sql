-- WUPCare 0010: student self-registration with clinic staff approval.
-- Spec: SYSTEM_SPEC.md §4.1 (FR-AUTH-8), §4.9 (FR-USR-2), §8.10, §9.4.
--
-- Workflow:
--   1. A student signs up with email, Student ID, and password (Supabase
--      Auth signUp; the Student ID goes in user_metadata.student_number).
--   2. Once the email is confirmed (email_confirmed_at is set), the trigger
--      creates a profile with role 'student', no student link, and the
--      entered Student ID stored for staff to review. The role is fixed:
--      nothing the user submits can choose it.
--   3. Until clinic staff approve the link, private.current_student_id()
--      returns null, so the account sees no appointments and cannot request
--      one. Student accounts never read health records in any case.
--   4. Clinic staff verify the student and call approve_student_link(),
--      which links the account to the existing student record.
--
-- Admin-created accounts (app_metadata.wupcare_role, migration 0009) work as
-- before. Users can never write app_metadata, so self-registration cannot
-- produce a staff or admin profile.

-- ---------------------------------------------------------------------------
-- profiles: a student account may wait for approval without a link.
-- ---------------------------------------------------------------------------
alter table public.profiles
  drop constraint profiles_student_link,
  add constraint profiles_student_link check (role = 'student' or student_id is null),
  -- Entered at registration. Shown to clinic staff only; never trusted for access.
  add column requested_student_number text
    check (char_length(requested_student_number) between 1 and 40);

-- ---------------------------------------------------------------------------
-- Profile creation from auth.users.
--   * Admin-created: app_metadata.wupcare_role (service role only). A
--     student created this way must come with a student_id.
--   * Self-registered: user_metadata.student_number present and the email
--     confirmed. Always role 'student', never linked here.
-- Creates a profile only if none exists; never changes an existing one.
-- ---------------------------------------------------------------------------
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app   jsonb := coalesce(new.raw_app_meta_data, '{}'::jsonb);
  v_user  jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role  public.user_role;
begin
  if v_app ? 'wupcare_role' then
    v_role := (v_app ->> 'wupcare_role')::public.user_role;
    if v_role = 'student' and nullif(v_app ->> 'student_id', '') is null then
      raise exception 'A student account created by an administrator must be linked to a student record.';
    end if;

    insert into public.profiles (id, full_name, email, role, student_id)
    values (
      new.id,
      coalesce(nullif(btrim(v_app ->> 'full_name'), ''), new.email),
      coalesce(new.email, ''),
      v_role,
      nullif(v_app ->> 'student_id', '')::uuid
    )
    on conflict (id) do nothing;

  elsif new.email_confirmed_at is not null and v_user ? 'student_number' then
    insert into public.profiles (id, full_name, email, role, requested_student_number)
    values (
      new.id,
      left(coalesce(new.email, 'Student'), 120),
      coalesce(new.email, ''),
      'student',
      left(nullif(btrim(v_user ->> 'student_number'), ''), 40)
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;

drop trigger on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of raw_app_meta_data, email_confirmed_at on auth.users
  for each row execute function private.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Profile guard (replaces 0003): role and active status are admin-only, and
-- an admin cannot change their own. The student link may be changed by an
-- admin, or set once by clinic staff when approving a pending student
-- account. Staff have no UPDATE policy on profiles, so approval is only
-- reachable through approve_student_link().
-- ---------------------------------------------------------------------------
create or replace function private.guard_profile_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_role  public.user_role;
begin
  if v_uid is null then
    return new;
  end if;

  v_role := private.current_user_role();

  if new.role is distinct from old.role or new.is_active is distinct from old.is_active then
    if v_role is distinct from 'admin' then
      raise exception 'Only an administrator can change roles or access.' using errcode = '42501';
    end if;
    if old.id = v_uid then
      raise exception 'You cannot change the role or access of your own account.' using errcode = '42501';
    end if;
  end if;

  if new.student_id is distinct from old.student_id then
    if v_role = 'admin' then
      if old.id = v_uid then
        raise exception 'You cannot change the role or access of your own account.' using errcode = '42501';
      end if;
    elsif not (v_role = 'clinic_staff'
               and old.role = 'student' and new.role = 'student'
               and old.student_id is null) then
      raise exception 'Not allowed to change this account''s student link.' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.guard_profile_update() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Clinic staff approve a pending student account by linking it to an
-- existing, active, real student record that has no account yet.
-- The profile name is replaced with the name on the student record.
-- ---------------------------------------------------------------------------
create function public.approve_student_link(
  p_profile_id  uuid,
  p_student_id  uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile  public.profiles;
  v_student  public.students;
begin
  perform private.require_role('clinic_staff');

  select * into v_profile from public.profiles where id = p_profile_id for update;
  if not found or v_profile.role <> 'student' or v_profile.student_id is not null then
    raise exception 'This account is not waiting for approval.' using errcode = '22023';
  end if;
  if not v_profile.is_active then
    raise exception 'This account is inactive.' using errcode = '22023';
  end if;

  select * into v_student from public.students where id = p_student_id for update;
  if not found then
    raise exception 'Student not found.' using errcode = 'P0002';
  end if;
  if v_student.status <> 'active' then
    raise exception 'Only active students can be linked to an account.' using errcode = '22023';
  end if;
  if v_student.is_demo then
    raise exception 'Demo student records cannot be linked to registered accounts.' using errcode = '22023';
  end if;
  if exists (select 1 from public.profiles p where p.student_id = p_student_id) then
    raise exception 'This student record already has an account.' using errcode = '22023';
  end if;

  update public.profiles
  set student_id = p_student_id,
      full_name  = left(concat_ws(' ', v_student.first_name, nullif(v_student.middle_name, ''), v_student.last_name), 120)
  where id = p_profile_id;
end;
$$;

revoke all on function public.approve_student_link(uuid, uuid) from public, anon;
grant execute on function public.approve_student_link(uuid, uuid) to authenticated;
