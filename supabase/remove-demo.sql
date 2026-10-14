-- WUPCare demo cleanup (SYSTEM_SPEC §11).
--
-- Deletes demo data only: rows of demo students (is_demo = true) and demo
-- medicines, and everything linked to them. Real records are never touched:
-- the database keeps real and demo apart (a visit, incident, appointment, or
-- issuance always belongs to one student, and demo medicines can only be
-- issued to demo students).
--
-- Demo students that are linked to a login account (for example the demo
-- student account) are kept, with their health record, so the account keeps
-- working. Their activity is still removed.
--
-- Run as a single transaction, for example in the Supabase SQL editor.

begin;

delete from public.medication_transactions t
using public.medicines m
where t.medicine_id = m.id and m.is_demo;

delete from public.medication_transactions t
using public.students s
where t.student_id = s.id and s.is_demo;

delete from public.health_incidents i
using public.students s
where i.student_id = s.id and s.is_demo;

delete from public.clinic_visits v
using public.students s
where v.student_id = s.id and s.is_demo;

delete from public.appointments a
using public.students s
where a.student_id = s.id and s.is_demo;

delete from public.medicines where is_demo;

delete from public.health_records h
using public.students s
where h.student_id = s.id and s.is_demo
  and not exists (select 1 from public.profiles p where p.student_id = s.id);

delete from public.students s
where s.is_demo
  and not exists (select 1 from public.profiles p where p.student_id = s.id);

commit;

-- Summary
select
  (select count(*) from public.students where is_demo)::int as demo_students_kept_for_accounts,
  (select count(*) from public.medicines where is_demo)::int as demo_medicines,
  (select count(*) from public.students where not is_demo)::int as real_students,
  (select count(*) from public.medicines where not is_demo)::int as real_medicines;
