-- WUPCare 0004: inventory and the atomic visit / incident save functions.
-- Spec: SYSTEM_SPEC.md §4.4 (FR-VIS-3), §4.6 (FR-MED-3..6), §4.7 (FR-INC-3), §8.2, §8.5, §9.4.
--
-- Stock rules:
--   * Clinic staff have no direct write access to medicines.stock_quantity
--     or to medication_transactions (column grants in 0006). Every stock
--     change goes through these functions, so stock always equals the sum
--     of the ledger.
--   * The medicine row is locked (SELECT ... FOR UPDATE) before stock is
--     checked, so two concurrent issuances cannot both pass the check.
--   * Items are merged per medicine and locked in medicine_id order, which
--     prevents deadlocks between two multi-item saves.
--   * Any failure raises and rolls back the whole call: the visit or
--     incident and all of its issuances save together or not at all.
--
-- The public functions are SECURITY DEFINER (they must write the ledger
-- that the caller cannot write) and each one checks the caller's role first.

-- ---------------------------------------------------------------------------
-- Internal: issue a list of items to one student. Not callable by clients.
-- p_items: [{ "medicine_id": uuid, "quantity": integer >= 1 }, ...]
-- ---------------------------------------------------------------------------
create function private.issue_items(
  p_student_id  uuid,
  p_items       jsonb,
  p_visit_id    uuid,
  p_incident_id uuid,
  p_notes       text
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_item          record;
  v_med           public.medicines%rowtype;
  v_student_demo  boolean;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Medication items must be a list.' using errcode = '22023';
  end if;

  if jsonb_array_length(p_items) = 0 then
    return;
  end if;

  select s.is_demo into v_student_demo
  from public.students s
  where s.id = p_student_id;

  if not found then
    raise exception 'Student not found.' using errcode = 'P0002';
  end if;

  for v_item in
    select
      (e ->> 'medicine_id')::uuid                     as medicine_id,
      sum((e ->> 'quantity')::integer)::integer       as quantity,
      coalesce(bool_and((e ->> 'quantity')::integer >= 1), false) as valid_qty
    from jsonb_array_elements(p_items) as e
    group by 1
    order by 1
  loop
    if v_item.medicine_id is null or not v_item.valid_qty then
      raise exception 'Each medication needs a medicine and a quantity of 1 or more.'
        using errcode = '22023';
    end if;

    select * into v_med
    from public.medicines m
    where m.id = v_item.medicine_id
    for update;

    if not found then
      raise exception 'Medicine not found.' using errcode = 'P0002';
    end if;
    if not v_med.is_active then
      raise exception '% is inactive and cannot be issued.', v_med.name;
    end if;
    if v_med.expiration_date < private.manila_today() then
      raise exception '% expired on % and cannot be issued.', v_med.name, v_med.expiration_date;
    end if;
    if v_med.is_demo <> v_student_demo then
      raise exception 'Demo medicines can only be issued to demo students, and real medicines only to real students.';
    end if;
    if v_med.stock_quantity < v_item.quantity then
      raise exception 'Not enough stock for %: % % available, % requested.',
        v_med.name, v_med.stock_quantity, v_med.unit, v_item.quantity;
    end if;

    update public.medicines
    set stock_quantity = stock_quantity - v_item.quantity
    where id = v_med.id;

    insert into public.medication_transactions
      (medicine_id, type, quantity, student_id, clinic_visit_id, incident_id, notes, performed_by)
    values
      (v_med.id, 'issuance', -v_item.quantity, p_student_id, p_visit_id, p_incident_id,
       nullif(btrim(p_notes), ''), (select auth.uid()));
  end loop;
end;
$$;

revoke all on function private.issue_items(uuid, jsonb, uuid, uuid, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Standalone issuance from the medicine page (spec §8.5).
-- Optional visit / incident link must belong to the same student (enforced
-- by the composite foreign keys on medication_transactions).
-- ---------------------------------------------------------------------------
create function public.issue_medication(
  p_medicine_id      uuid,
  p_student_id       uuid,
  p_quantity         integer,
  p_clinic_visit_id  uuid default null,
  p_incident_id      uuid default null,
  p_notes            text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_role('clinic_staff');
  perform private.issue_items(
    p_student_id,
    jsonb_build_array(jsonb_build_object('medicine_id', p_medicine_id, 'quantity', p_quantity)),
    p_clinic_visit_id,
    p_incident_id,
    p_notes
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Restock: adds stock. Returns the new stock quantity.
-- ---------------------------------------------------------------------------
create function public.restock_medication(
  p_medicine_id  uuid,
  p_quantity     integer,
  p_notes        text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stock integer;
begin
  perform private.require_role('clinic_staff');

  if p_quantity is null or p_quantity < 1 then
    raise exception 'Restock quantity must be 1 or more.' using errcode = '22023';
  end if;

  update public.medicines
  set stock_quantity = stock_quantity + p_quantity
  where id = p_medicine_id
  returning stock_quantity into v_stock;

  if not found then
    raise exception 'Medicine not found.' using errcode = 'P0002';
  end if;

  insert into public.medication_transactions (medicine_id, type, quantity, notes, performed_by)
  values (p_medicine_id, 'restock', p_quantity, nullif(btrim(p_notes), ''), (select auth.uid()));

  return v_stock;
end;
$$;

-- ---------------------------------------------------------------------------
-- Adjustment: signed correction with a required reason. Returns new stock.
-- ---------------------------------------------------------------------------
create function public.adjust_medication(
  p_medicine_id  uuid,
  p_quantity     integer,
  p_reason       text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_med public.medicines%rowtype;
begin
  perform private.require_role('clinic_staff');

  if p_quantity is null or p_quantity = 0 then
    raise exception 'Adjustment quantity cannot be zero.' using errcode = '22023';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'A reason is required for a stock adjustment.' using errcode = '22023';
  end if;

  select * into v_med
  from public.medicines m
  where m.id = p_medicine_id
  for update;

  if not found then
    raise exception 'Medicine not found.' using errcode = 'P0002';
  end if;
  if v_med.stock_quantity + p_quantity < 0 then
    raise exception 'Adjustment would make stock negative: % % available.',
      v_med.stock_quantity, v_med.unit;
  end if;

  update public.medicines
  set stock_quantity = stock_quantity + p_quantity
  where id = p_medicine_id;

  insert into public.medication_transactions (medicine_id, type, quantity, notes, performed_by)
  values (p_medicine_id, 'adjustment', p_quantity, btrim(p_reason), (select auth.uid()));

  return v_med.stock_quantity + p_quantity;
end;
$$;

-- ---------------------------------------------------------------------------
-- Save a clinic visit and its medication in one transaction (spec §8.2).
-- p_visit: { student_id, visit_at?, reason, symptoms?, concern_category_id,
--            assessment?, treatment?, follow_up_instructions?, appointment_id? }
-- attended_by is always the caller. Returns the new visit id.
-- ---------------------------------------------------------------------------
create function public.create_visit_with_medications(
  p_visit  jsonb,
  p_items  jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v     public.clinic_visits;
  v_id  uuid;
begin
  perform private.require_role('clinic_staff');

  v := jsonb_populate_record(null::public.clinic_visits, p_visit);

  if not exists (
    select 1 from public.health_concern_categories c
    where c.id = v.concern_category_id and c.is_active
  ) then
    raise exception 'Choose a valid health concern category.' using errcode = '22023';
  end if;

  if v.appointment_id is not null and not exists (
    select 1 from public.appointments a
    where a.id = v.appointment_id
      and a.student_id = v.student_id
      and a.status = 'completed'
  ) then
    raise exception 'A visit can only be linked to a completed appointment of the same student.'
      using errcode = '22023';
  end if;

  insert into public.clinic_visits (
    student_id, visit_at, reason, symptoms, concern_category_id,
    assessment, treatment, follow_up_instructions, attended_by, appointment_id
  )
  values (
    v.student_id, coalesce(v.visit_at, now()), v.reason, v.symptoms, v.concern_category_id,
    v.assessment, v.treatment, v.follow_up_instructions, (select auth.uid()), v.appointment_id
  )
  returning id into v_id;

  perform private.issue_items(v.student_id, coalesce(p_items, '[]'::jsonb), v_id, null, null);

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Save a health incident and its medication in one transaction (spec §8.6).
-- p_incident: { student_id, occurred_at, type, location?, description,
--               action_taken, clinic_visit_id? }
-- recorded_by is always the caller. Returns the new incident id.
-- ---------------------------------------------------------------------------
create function public.create_incident_with_medications(
  p_incident  jsonb,
  p_items     jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v     public.health_incidents;
  v_id  uuid;
begin
  perform private.require_role('clinic_staff');

  v := jsonb_populate_record(null::public.health_incidents, p_incident);

  insert into public.health_incidents (
    student_id, occurred_at, type, location, description,
    action_taken, clinic_visit_id, recorded_by
  )
  values (
    v.student_id, v.occurred_at, v.type, v.location, v.description,
    v.action_taken, v.clinic_visit_id, (select auth.uid())
  )
  returning id into v_id;

  perform private.issue_items(v.student_id, coalesce(p_items, '[]'::jsonb), null, v_id, null);

  return v_id;
end;
$$;

revoke all on function public.issue_medication(uuid, uuid, integer, uuid, uuid, text) from public, anon;
revoke all on function public.restock_medication(uuid, integer, text) from public, anon;
revoke all on function public.adjust_medication(uuid, integer, text) from public, anon;
revoke all on function public.create_visit_with_medications(jsonb, jsonb) from public, anon;
revoke all on function public.create_incident_with_medications(jsonb, jsonb) from public, anon;

grant execute on function public.issue_medication(uuid, uuid, integer, uuid, uuid, text) to authenticated;
grant execute on function public.restock_medication(uuid, integer, text) to authenticated;
grant execute on function public.adjust_medication(uuid, integer, text) to authenticated;
grant execute on function public.create_visit_with_medications(jsonb, jsonb) to authenticated;
grant execute on function public.create_incident_with_medications(jsonb, jsonb) to authenticated;
