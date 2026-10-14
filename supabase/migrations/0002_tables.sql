-- WUPCare 0002: the 10 baseline tables, constraints, and indexes.
-- Spec: SYSTEM_SPEC.md §9.1, §9.3, §9.5, §7.
--
-- Security note: this project's default privileges grant anon and
-- authenticated ALL on new tables in public. Every table below therefore
-- gets RLS enabled and all table privileges revoked at creation time.
-- Policies and the minimal column-level grants are added in 0006_rls.sql.
-- Until then, only the service role and postgres can touch these tables.
--
-- Cross-table "same student" rules are declarative: child rows reference
-- (id, student_id) of the parent, so a visit cannot point at another
-- student's appointment, an issuance cannot point at another student's
-- visit, and so on.

-- ---------------------------------------------------------------------------
-- profiles: application user, 1:1 with auth.users
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null check (char_length(btrim(full_name)) between 1 and 120),
  email       text not null,
  role        public.user_role not null,
  -- student_id is added below, after public.students exists.
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

-- ---------------------------------------------------------------------------
-- students
-- ---------------------------------------------------------------------------
create table public.students (
  id                     uuid primary key default gen_random_uuid(),
  student_number         text not null unique
                         check (char_length(btrim(student_number)) between 1 and 40),
  first_name             text not null check (char_length(btrim(first_name)) between 1 and 80),
  middle_name            text check (char_length(middle_name) <= 80),
  last_name              text not null check (char_length(btrim(last_name)) between 1 and 80),
  sex                    text check (sex in ('male', 'female')),
  -- "In the past" is checked by the app (zod); CHECK must stay immutable.
  birth_date             date check (birth_date >= date '1900-01-01'),
  college                text check (char_length(college) <= 120),
  program                text check (char_length(program) <= 120),
  year_level             smallint check (year_level between 1 and 6),
  contact_number         text check (char_length(contact_number) <= 20),
  email                  text check (char_length(email) <= 254),
  address                text check (char_length(address) <= 300),
  guardian_name          text check (char_length(guardian_name) <= 120),
  guardian_relationship  text check (char_length(guardian_relationship) <= 60),
  guardian_contact       text check (char_length(guardian_contact) <= 20),
  status                 public.student_status not null default 'active',
  is_demo                boolean not null default false,
  created_by             uuid default auth.uid() references public.profiles (id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  updated_by             uuid references public.profiles (id),
  -- Demo records, and only demo records, use the DEMO- prefix (spec §7, §11).
  constraint students_demo_prefix check (is_demo = (student_number like 'DEMO-%'))
);

create index students_name_idx on public.students (last_name, first_name);
create index students_is_demo_idx on public.students (is_demo);

alter table public.profiles
  add column student_id uuid unique references public.students (id),
  add constraint profiles_updated_by_fkey foreign key (updated_by) references public.profiles (id),
  -- A student account is linked to exactly one student profile; staff and
  -- admin accounts are never linked (FR-USR-2).
  add constraint profiles_student_link check ((role = 'student') = (student_id is not null));

-- ---------------------------------------------------------------------------
-- health_records: exactly one per student (created by trigger, 0003)
-- ---------------------------------------------------------------------------
create table public.health_records (
  id                              uuid primary key default gen_random_uuid(),
  student_id                      uuid not null unique references public.students (id),
  medical_history                 text check (char_length(medical_history) <= 2000),
  allergies                       text check (char_length(allergies) <= 2000),
  existing_conditions             text check (char_length(existing_conditions) <= 2000),
  immunizations                   text check (char_length(immunizations) <= 2000),
  health_notes                    text check (char_length(health_notes) <= 2000),
  emergency_contact_name          text check (char_length(emergency_contact_name) <= 120),
  emergency_contact_relationship  text check (char_length(emergency_contact_relationship) <= 60),
  emergency_contact_number        text check (char_length(emergency_contact_number) <= 20),
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now(),
  updated_by                      uuid references public.profiles (id)
);

-- ---------------------------------------------------------------------------
-- health_concern_categories: lookup list (seeded in 0008)
-- ---------------------------------------------------------------------------
create table public.health_concern_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (char_length(btrim(name)) between 1 and 80),
  sort_order  smallint not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- appointments
-- ---------------------------------------------------------------------------
create table public.appointments (
  id                uuid primary key default gen_random_uuid(),
  student_id        uuid not null references public.students (id),
  requested_by      uuid not null default auth.uid() references public.profiles (id),
  reason            text not null check (char_length(btrim(reason)) between 1 and 2000),
  preferred_date    date not null,
  preferred_time    time not null,
  scheduled_at      timestamptz,
  status            public.appointment_status not null default 'pending',
  reschedule_count  smallint not null default 0 check (reschedule_count >= 0),
  staff_remarks     text check (char_length(staff_remarks) <= 2000),
  handled_by        uuid references public.profiles (id),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  updated_by        uuid references public.profiles (id),
  constraint appointments_id_student_key unique (id, student_id),
  -- Approved and completed appointments always have a schedule.
  constraint appointments_schedule_required
    check (status not in ('approved', 'completed') or scheduled_at is not null),
  -- Declining requires a remark the student can read (FR-APT-3).
  constraint appointments_decline_remark
    check (status <> 'declined' or nullif(btrim(staff_remarks), '') is not null)
);

create index appointments_status_scheduled_idx on public.appointments (status, scheduled_at);
create index appointments_student_created_idx on public.appointments (student_id, created_at desc);
-- At most one pending request per student. Race-safe; the app maps this
-- index name (error 23505) to "You already have a pending request."
create unique index appointments_one_pending_per_student
  on public.appointments (student_id) where status = 'pending';

-- ---------------------------------------------------------------------------
-- clinic_visits
-- ---------------------------------------------------------------------------
create table public.clinic_visits (
  id                      uuid primary key default gen_random_uuid(),
  student_id              uuid not null references public.students (id),
  visit_at                timestamptz not null default now(),
  reason                  text not null check (char_length(btrim(reason)) between 1 and 2000),
  symptoms                text check (char_length(symptoms) <= 2000),
  concern_category_id     uuid not null references public.health_concern_categories (id),
  assessment              text check (char_length(assessment) <= 2000),
  treatment               text check (char_length(treatment) <= 2000),
  follow_up_instructions  text check (char_length(follow_up_instructions) <= 2000),
  attended_by             uuid not null references public.profiles (id),
  appointment_id          uuid unique,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  updated_by              uuid references public.profiles (id),
  constraint clinic_visits_id_student_key unique (id, student_id),
  constraint clinic_visits_appointment_fkey foreign key (appointment_id, student_id)
    references public.appointments (id, student_id)
);

create index clinic_visits_student_visit_at_idx on public.clinic_visits (student_id, visit_at desc);
create index clinic_visits_visit_at_idx on public.clinic_visits (visit_at);
create index clinic_visits_concern_category_idx on public.clinic_visits (concern_category_id);

-- ---------------------------------------------------------------------------
-- health_incidents
-- ---------------------------------------------------------------------------
create table public.health_incidents (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.students (id),
  occurred_at      timestamptz not null,
  type             public.incident_type not null,
  location         text check (char_length(location) <= 200),
  description      text not null check (char_length(btrim(description)) between 1 and 2000),
  action_taken     text not null check (char_length(btrim(action_taken)) between 1 and 2000),
  clinic_visit_id  uuid,
  recorded_by      uuid not null references public.profiles (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references public.profiles (id),
  constraint health_incidents_id_student_key unique (id, student_id),
  constraint health_incidents_visit_fkey foreign key (clinic_visit_id, student_id)
    references public.clinic_visits (id, student_id)
);

create index health_incidents_student_occurred_idx on public.health_incidents (student_id, occurred_at desc);
create index health_incidents_occurred_at_idx on public.health_incidents (occurred_at);
create index health_incidents_clinic_visit_idx on public.health_incidents (clinic_visit_id);

-- ---------------------------------------------------------------------------
-- clinic_settings: exactly one row (seeded in 0008)
-- ---------------------------------------------------------------------------
create table public.clinic_settings (
  id              smallint primary key default 1 check (id = 1),
  -- ISO weekdays: 1 = Monday ... 7 = Sunday
  open_days       smallint[] not null default '{1,2,3,4,5}'
                  check (cardinality(open_days) between 1 and 7
                         and open_days <@ '{1,2,3,4,5,6,7}'::smallint[]),
  open_time       time not null default '08:00',
  close_time      time not null default '17:00',
  max_days_ahead  smallint not null default 30 check (max_days_ahead between 1 and 365),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id),
  constraint clinic_settings_hours check (close_time > open_time)
);

-- ---------------------------------------------------------------------------
-- medicines
-- ---------------------------------------------------------------------------
create table public.medicines (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (char_length(btrim(name)) between 1 and 120),
  unit             text not null check (char_length(btrim(unit)) between 1 and 40),
  stock_quantity   integer not null default 0 check (stock_quantity >= 0),
  reorder_level    integer not null default 10 check (reorder_level >= 0),
  expiration_date  date not null,
  is_active        boolean not null default true,
  is_demo          boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  updated_by       uuid references public.profiles (id)
);

create index medicines_name_idx on public.medicines (name);

-- ---------------------------------------------------------------------------
-- medication_transactions: append-only stock ledger
-- Written only by the inventory functions in 0004.
-- ---------------------------------------------------------------------------
create table public.medication_transactions (
  id               uuid primary key default gen_random_uuid(),
  medicine_id      uuid not null references public.medicines (id),
  type             public.med_txn_type not null,
  -- Signed change to stock: negative for issuance, positive for restock.
  quantity         integer not null check (quantity <> 0),
  student_id       uuid references public.students (id),
  clinic_visit_id  uuid,
  incident_id      uuid,
  notes            text check (char_length(notes) <= 2000),
  performed_by     uuid not null references public.profiles (id),
  created_at       timestamptz not null default now(),
  constraint medication_transactions_visit_fkey foreign key (clinic_visit_id, student_id)
    references public.clinic_visits (id, student_id),
  constraint medication_transactions_incident_fkey foreign key (incident_id, student_id)
    references public.health_incidents (id, student_id),
  constraint medication_transactions_shape check (
    case type
      when 'issuance'   then quantity < 0 and student_id is not null
      when 'restock'    then quantity > 0 and student_id is null
                             and clinic_visit_id is null and incident_id is null
      when 'adjustment' then student_id is null
                             and clinic_visit_id is null and incident_id is null
                             and nullif(btrim(notes), '') is not null
    end
  )
);

create index medication_transactions_medicine_created_idx
  on public.medication_transactions (medicine_id, created_at desc);
create index medication_transactions_student_idx on public.medication_transactions (student_id);
create index medication_transactions_created_at_idx on public.medication_transactions (created_at);
create index medication_transactions_visit_idx on public.medication_transactions (clinic_visit_id);
create index medication_transactions_incident_idx on public.medication_transactions (incident_id);

-- ---------------------------------------------------------------------------
-- Lock everything down until 0006 adds policies and minimal grants.
-- ---------------------------------------------------------------------------
alter table public.profiles                  enable row level security;
alter table public.students                  enable row level security;
alter table public.health_records            enable row level security;
alter table public.health_concern_categories enable row level security;
alter table public.appointments              enable row level security;
alter table public.clinic_visits             enable row level security;
alter table public.health_incidents          enable row level security;
alter table public.clinic_settings           enable row level security;
alter table public.medicines                 enable row level security;
alter table public.medication_transactions   enable row level security;

revoke all on
  public.profiles, public.students, public.health_records,
  public.health_concern_categories, public.appointments, public.clinic_visits,
  public.health_incidents, public.clinic_settings, public.medicines,
  public.medication_transactions
from public, anon, authenticated;
