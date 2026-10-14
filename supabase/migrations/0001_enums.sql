-- WUPCare 0001: enum types and the private schema.
-- Spec: SYSTEM_SPEC.md §9.2.

create type public.user_role as enum ('admin', 'clinic_staff', 'student');
create type public.student_status as enum ('active', 'inactive', 'graduated');
create type public.appointment_status as enum ('pending', 'approved', 'declined', 'cancelled', 'completed');
create type public.incident_type as enum ('illness', 'injury', 'accident', 'other');
create type public.med_txn_type as enum ('issuance', 'restock', 'adjustment');

-- Internal helpers (role lookups, trigger functions) live here.
-- This schema is not exposed through the Data API, so clients cannot call
-- its functions directly. `authenticated` needs USAGE only because RLS
-- policies call private.current_user_role() and private.current_student_id().
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
