-- WUPCare 0006: RLS policies and minimal grants.
-- Spec: SYSTEM_SPEC.md §3.2, §10.3, §11 (UI cannot set is_demo).
--
-- Two layers:
--   1. GRANTs say which columns the `authenticated` role may touch at all.
--      They are the same for every app role (Postgres sees one DB role),
--      so they hold the rules that apply to everyone: no DELETE anywhere,
--      no direct stock or ledger writes, no is_demo, no audit columns,
--      no changing a record's student.
--   2. RLS policies say which rows each app role may touch.
--
-- anon gets nothing. Administrators get no SELECT on clinical tables; they
-- read aggregates through the report_* functions (0007).
-- Role helpers are wrapped in (select ...) so Postgres evaluates them once
-- per statement instead of once per row.

-- ===========================================================================
-- GRANTS
-- ===========================================================================

grant select on public.profiles to authenticated;
grant update (full_name, role, is_active, student_id) on public.profiles to authenticated;

grant select on public.students to authenticated;
grant insert (
  student_number, first_name, middle_name, last_name, sex, birth_date, college,
  program, year_level, contact_number, email, address, guardian_name,
  guardian_relationship, guardian_contact, status
) on public.students to authenticated;
grant update (
  student_number, first_name, middle_name, last_name, sex, birth_date, college,
  program, year_level, contact_number, email, address, guardian_name,
  guardian_relationship, guardian_contact, status
) on public.students to authenticated;

grant select on public.health_records to authenticated;
grant update (
  medical_history, allergies, existing_conditions, immunizations, health_notes,
  emergency_contact_name, emergency_contact_relationship, emergency_contact_number
) on public.health_records to authenticated;

grant select on public.health_concern_categories to authenticated;

grant select on public.appointments to authenticated;
grant insert (
  student_id, reason, preferred_date, preferred_time, scheduled_at, status, staff_remarks
) on public.appointments to authenticated;
grant update (status, scheduled_at, staff_remarks) on public.appointments to authenticated;

-- Visits and incidents are created only through the 0004 functions.
grant select on public.clinic_visits to authenticated;
grant update (
  visit_at, reason, symptoms, concern_category_id, assessment, treatment, follow_up_instructions
) on public.clinic_visits to authenticated;

grant select on public.health_incidents to authenticated;
grant update (
  occurred_at, type, location, description, action_taken, clinic_visit_id
) on public.health_incidents to authenticated;

grant select on public.clinic_settings to authenticated;
grant update (open_days, open_time, close_time, max_days_ahead) on public.clinic_settings to authenticated;

-- New medicines start at 0 stock; starting stock is a restock call.
grant select on public.medicines to authenticated;
grant insert (name, unit, reorder_level, expiration_date) on public.medicines to authenticated;
grant update (name, unit, reorder_level, expiration_date, is_active) on public.medicines to authenticated;

grant select on public.medication_transactions to authenticated;

-- ===========================================================================
-- POLICIES
-- ===========================================================================

-- profiles ------------------------------------------------------------------
-- Own row is readable even when inactive, so the app can show "account
-- inactive" instead of a generic error.
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or (select private.current_user_role()) in ('admin', 'clinic_staff')
  );

create policy profiles_update on public.profiles
  for update to authenticated
  using ((select private.current_user_role()) = 'admin')
  with check ((select private.current_user_role()) = 'admin');

-- students ------------------------------------------------------------------
create policy students_select on public.students
  for select to authenticated
  using ((select private.current_user_role()) = 'clinic_staff');

create policy students_insert on public.students
  for insert to authenticated
  with check (
    (select private.current_user_role()) = 'clinic_staff'
    and created_by = (select auth.uid())
  );

create policy students_update on public.students
  for update to authenticated
  using ((select private.current_user_role()) = 'clinic_staff')
  with check ((select private.current_user_role()) = 'clinic_staff');

-- health_records (rows are created by trigger) -----------------------------
create policy health_records_select on public.health_records
  for select to authenticated
  using ((select private.current_user_role()) = 'clinic_staff');

create policy health_records_update on public.health_records
  for update to authenticated
  using ((select private.current_user_role()) = 'clinic_staff')
  with check ((select private.current_user_role()) = 'clinic_staff');

-- health_concern_categories -------------------------------------------------
create policy health_concern_categories_select on public.health_concern_categories
  for select to authenticated
  using ((select private.current_user_role()) in ('admin', 'clinic_staff'));

-- appointments --------------------------------------------------------------
create policy appointments_select on public.appointments
  for select to authenticated
  using (
    (select private.current_user_role()) = 'clinic_staff'
    or student_id = (select private.current_student_id())
  );

-- Students may only create a plain pending request for themselves.
create policy appointments_insert on public.appointments
  for insert to authenticated
  with check (
    requested_by = (select auth.uid())
    and (
      (select private.current_user_role()) = 'clinic_staff'
      or (
        student_id = (select private.current_student_id())
        and status = 'pending'
        and scheduled_at is null
        and staff_remarks is null
      )
    )
  );

-- Students: own pending rows, ending as cancelled. The 0005 trigger blocks
-- any other change.
create policy appointments_update on public.appointments
  for update to authenticated
  using (
    (select private.current_user_role()) = 'clinic_staff'
    or (student_id = (select private.current_student_id()) and status = 'pending')
  )
  with check (
    (select private.current_user_role()) = 'clinic_staff'
    or (student_id = (select private.current_student_id()) and status = 'cancelled')
  );

-- clinic_visits -------------------------------------------------------------
create policy clinic_visits_select on public.clinic_visits
  for select to authenticated
  using ((select private.current_user_role()) = 'clinic_staff');

create policy clinic_visits_update on public.clinic_visits
  for update to authenticated
  using ((select private.current_user_role()) = 'clinic_staff')
  with check ((select private.current_user_role()) = 'clinic_staff');

-- health_incidents ----------------------------------------------------------
create policy health_incidents_select on public.health_incidents
  for select to authenticated
  using ((select private.current_user_role()) = 'clinic_staff');

create policy health_incidents_update on public.health_incidents
  for update to authenticated
  using ((select private.current_user_role()) = 'clinic_staff')
  with check ((select private.current_user_role()) = 'clinic_staff');

-- clinic_settings -----------------------------------------------------------
-- Any active user can read it; the student request form needs the hours.
create policy clinic_settings_select on public.clinic_settings
  for select to authenticated
  using ((select private.current_user_role()) is not null);

create policy clinic_settings_update on public.clinic_settings
  for update to authenticated
  using ((select private.current_user_role()) = 'clinic_staff')
  with check ((select private.current_user_role()) = 'clinic_staff');

-- medicines -----------------------------------------------------------------
create policy medicines_select on public.medicines
  for select to authenticated
  using ((select private.current_user_role()) = 'clinic_staff');

create policy medicines_insert on public.medicines
  for insert to authenticated
  with check ((select private.current_user_role()) = 'clinic_staff');

create policy medicines_update on public.medicines
  for update to authenticated
  using ((select private.current_user_role()) = 'clinic_staff')
  with check ((select private.current_user_role()) = 'clinic_staff');

-- medication_transactions (written only by 0004 functions) -----------------
create policy medication_transactions_select on public.medication_transactions
  for select to authenticated
  using ((select private.current_user_role()) = 'clinic_staff');
