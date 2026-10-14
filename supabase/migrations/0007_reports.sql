-- WUPCare 0007: aggregate reports and the admin account-linking functions.
-- Spec: SYSTEM_SPEC.md §3.2, §4.8 (FR-RPT-1, FR-RPT-3), §8.7, §8.8, §9.4.
--
-- Report functions are SECURITY DEFINER because administrators have no
-- SELECT on clinical tables. They return counts only: no names, no
-- student ids, no clinical text. Allowed callers: admin, clinic_staff.
--
-- Common parameters:
--   p_from, p_to  inclusive dates, interpreted in Asia/Manila time
--   p_scope       'real' (default), 'demo', or 'all'; filters on
--                 students.is_demo (medicines.is_demo for medication usage)
--
-- Administrator privacy rules (spec §3.2: aggregates only, RA 10173):
--   * The range is widened to whole calendar months, and visits can only
--     be grouped by month. Day-level counts could single out a student.
--   * Counts from 1 to 4 are returned as null (the app shows "<5").
-- Clinic staff, who already read the underlying records, get exact counts
-- for any range.

-- ---------------------------------------------------------------------------
-- Internal: checks the caller and arguments, and returns the effective
-- range (month-aligned for administrators).
-- ---------------------------------------------------------------------------
create function private.report_range(
  p_from        date,
  p_to          date,
  p_scope       text,
  out from_day  date,
  out to_day    date,
  out is_admin  boolean
)
language plpgsql
stable
set search_path = ''
as $$
begin
  is_admin := private.require_role('admin', 'clinic_staff') = 'admin';

  if p_from is null or p_to is null or p_to < p_from then
    raise exception 'Choose a valid date range.' using errcode = '22023';
  end if;
  if p_scope is null or p_scope not in ('real', 'demo', 'all') then
    raise exception 'Scope must be real, demo, or all.' using errcode = '22023';
  end if;

  if is_admin then
    from_day := date_trunc('month', p_from)::date;
    to_day   := (date_trunc('month', p_to) + interval '1 month - 1 day')::date;
  else
    from_day := p_from;
    to_day   := p_to;
  end if;
end;
$$;

-- Small-count suppression for administrators.
create function private.mask_count(p_count bigint, p_is_admin boolean)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select case when p_is_admin and p_count between 1 and 4 then null else p_count end;
$$;

-- Does a row with this is_demo value fall in the scope?
create function private.in_scope(p_is_demo boolean, p_scope text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_scope = 'all' or (p_scope = 'demo') = p_is_demo;
$$;

-- Start of a Manila calendar day as timestamptz.
create function private.manila_day_start(p_day date)
returns timestamptz
language sql
immutable
set search_path = ''
as $$
  select p_day::timestamp at time zone 'Asia/Manila';
$$;

revoke all on function private.report_range(date, date, text) from public, anon, authenticated;
revoke all on function private.mask_count(bigint, boolean) from public, anon, authenticated;
revoke all on function private.in_scope(boolean, text) from public, anon, authenticated;
revoke all on function private.manila_day_start(date) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Clinic visits per day or per month (administrators: month only).
-- ---------------------------------------------------------------------------
create function public.report_visits(
  p_from    date,
  p_to      date,
  p_scope   text default 'real',
  p_period  text default 'day'
)
returns table (period date, visit_count bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r record;
begin
  r := private.report_range(p_from, p_to, p_scope);
  if p_period is null or p_period not in ('day', 'month') then
    raise exception 'Period must be day or month.' using errcode = '22023';
  end if;
  if r.is_admin and p_period <> 'month' then
    raise exception 'Administrators can view monthly totals only.' using errcode = '42501';
  end if;

  return query
  select
    date_trunc(p_period, v.visit_at at time zone 'Asia/Manila')::date,
    private.mask_count(count(*), r.is_admin)
  from public.clinic_visits v
  join public.students s on s.id = v.student_id
  where v.visit_at >= private.manila_day_start(r.from_day)
    and v.visit_at <  private.manila_day_start(r.to_day + 1)
    and private.in_scope(s.is_demo, p_scope)
  group by 1
  order by 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- Common health concerns: visits per concern category.
-- ---------------------------------------------------------------------------
create function public.report_concerns(
  p_from   date,
  p_to     date,
  p_scope  text default 'real'
)
returns table (category text, visit_count bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r record;
begin
  r := private.report_range(p_from, p_to, p_scope);

  return query
  select c.name, private.mask_count(count(*), r.is_admin)
  from public.clinic_visits v
  join public.students s on s.id = v.student_id
  join public.health_concern_categories c on c.id = v.concern_category_id
  where v.visit_at >= private.manila_day_start(r.from_day)
    and v.visit_at <  private.manila_day_start(r.to_day + 1)
    and private.in_scope(s.is_demo, p_scope)
  group by c.name, c.sort_order
  order by count(*) desc, c.sort_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- Medication usage: quantity issued per medicine in the range, plus current
-- stock. Lists every active medicine in scope, including zero usage.
-- ---------------------------------------------------------------------------
create function public.report_medication_usage(
  p_from   date,
  p_to     date,
  p_scope  text default 'real'
)
returns table (
  medicine_id      uuid,
  medicine_name    text,
  unit             text,
  quantity_issued  bigint,
  stock_quantity   integer,
  expiration_date  date
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r record;
begin
  r := private.report_range(p_from, p_to, p_scope);

  return query
  select
    m.id, m.name, m.unit,
    private.mask_count(coalesce(-sum(t.quantity), 0)::bigint, r.is_admin),
    m.stock_quantity,
    m.expiration_date
  from public.medicines m
  left join public.medication_transactions t
    on t.medicine_id = m.id
   and t.type = 'issuance'
   and t.created_at >= private.manila_day_start(r.from_day)
   and t.created_at <  private.manila_day_start(r.to_day + 1)
  where private.in_scope(m.is_demo, p_scope)
    and (m.is_active or t.id is not null)
  group by m.id
  order by coalesce(-sum(t.quantity), 0) desc, m.name;
end;
$$;

-- ---------------------------------------------------------------------------
-- Health incidents per type.
-- ---------------------------------------------------------------------------
create function public.report_incidents(
  p_from   date,
  p_to     date,
  p_scope  text default 'real'
)
returns table (incident_type public.incident_type, incident_count bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r record;
begin
  r := private.report_range(p_from, p_to, p_scope);

  return query
  select i.type, private.mask_count(count(*), r.is_admin)
  from public.health_incidents i
  join public.students s on s.id = i.student_id
  where i.occurred_at >= private.manila_day_start(r.from_day)
    and i.occurred_at <  private.manila_day_start(r.to_day + 1)
    and private.in_scope(s.is_demo, p_scope)
  group by i.type
  order by i.type;
end;
$$;

-- ---------------------------------------------------------------------------
-- Appointments per status, by preferred (requested) date.
-- ---------------------------------------------------------------------------
create function public.report_appointments(
  p_from   date,
  p_to     date,
  p_scope  text default 'real'
)
returns table (status public.appointment_status, appointment_count bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  r record;
begin
  r := private.report_range(p_from, p_to, p_scope);

  return query
  select a.status, private.mask_count(count(*), r.is_admin)
  from public.appointments a
  join public.students s on s.id = a.student_id
  where a.preferred_date between r.from_day and r.to_day
    and private.in_scope(s.is_demo, p_scope)
  group by a.status
  order by a.status;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin: student picker for linking a new student account (spec §8.8).
-- Returns only id, student number, and name of active students that have
-- no account yet. No health data.
-- ---------------------------------------------------------------------------
create function public.students_without_account()
returns table (id uuid, student_number text, full_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_role('admin');

  return query
  select
    s.id,
    s.student_number,
    concat_ws(' ', s.first_name, nullif(s.middle_name, ''), s.last_name)
  from public.students s
  where s.status = 'active'
    and not exists (select 1 from public.profiles p where p.student_id = s.id)
  order by s.last_name, s.first_name;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin: student number of each linked student account, for the user list
-- (PLAN.md Phase 7, task 5). Only students that already have an account.
-- ---------------------------------------------------------------------------
create function public.account_student_numbers()
returns table (profile_id uuid, student_number text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_role('admin');

  return query
  select p.id, s.student_number
  from public.profiles p
  join public.students s on s.id = p.student_id;
end;
$$;

revoke all on function public.report_visits(date, date, text, text) from public, anon;
revoke all on function public.report_concerns(date, date, text) from public, anon;
revoke all on function public.report_medication_usage(date, date, text) from public, anon;
revoke all on function public.report_incidents(date, date, text) from public, anon;
revoke all on function public.report_appointments(date, date, text) from public, anon;
revoke all on function public.students_without_account() from public, anon;
revoke all on function public.account_student_numbers() from public, anon;

grant execute on function public.report_visits(date, date, text, text) to authenticated;
grant execute on function public.report_concerns(date, date, text) to authenticated;
grant execute on function public.report_medication_usage(date, date, text) to authenticated;
grant execute on function public.report_incidents(date, date, text) to authenticated;
grant execute on function public.report_appointments(date, date, text) to authenticated;
grant execute on function public.students_without_account() to authenticated;
grant execute on function public.account_student_numbers() to authenticated;
