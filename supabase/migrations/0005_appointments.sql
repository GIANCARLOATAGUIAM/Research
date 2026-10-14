-- WUPCare 0005: appointment rules.
-- Spec: SYSTEM_SPEC.md §4.5 (FR-APT-1..9), §8.3, §8.4, §8.9.
--
-- One BEFORE trigger enforces, by caller role:
--   student       insert: within clinic hours (clinic_settings), pending only
--                 update: only pending -> cancelled, nothing else changes
--   clinic_staff  insert: pending or approved
--                 update: only the transitions in spec §8.3
--                 a new schedule on an approved appointment counts as a
--                 reschedule (reschedule_count + 1)
--                 handled_by is set to the staff member who acted
-- Writes with no JWT (service role, seed scripts) skip these checks; the
-- table constraints still apply. A JWT without an active profile
-- (deactivated or unprovisioned user) is rejected outright. RLS (0006)
-- decides which rows each role may touch at all.
-- At most one pending request per student: unique index in 0002.

create function private.enforce_appointment_rules()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_role      public.user_role := private.current_user_role();
  v_settings  public.clinic_settings;
  v_today     date := private.manila_today();
begin
  if v_role is null then
    if (select auth.uid()) is not null then
      raise exception 'Not allowed.' using errcode = '42501';
    end if;
    return new;
  end if;

  -- ------------------------------------------------------------- INSERT
  if tg_op = 'INSERT' then
    new.reschedule_count := 0;

    if v_role = 'student' then
      select * into v_settings from public.clinic_settings where id = 1;
      if not found then
        raise exception 'Clinic hours are not configured.';
      end if;

      if new.preferred_date < v_today
         or new.preferred_date > v_today + v_settings.max_days_ahead then
        raise exception 'Choose a date from today up to % days ahead.', v_settings.max_days_ahead
          using errcode = '22023';
      end if;
      if not (extract(isodow from new.preferred_date)::smallint = any (v_settings.open_days)) then
        raise exception 'The clinic is closed on that day.' using errcode = '22023';
      end if;
      if new.preferred_time < v_settings.open_time
         or new.preferred_time >= v_settings.close_time then
        raise exception 'Choose a time between % and %.',
          to_char(v_settings.open_time, 'HH24:MI'), to_char(v_settings.close_time, 'HH24:MI')
          using errcode = '22023';
      end if;
    elsif v_role = 'clinic_staff' then
      if new.status not in ('pending', 'approved') then
        raise exception 'A new appointment must be pending or approved.' using errcode = '22023';
      end if;
      if new.status = 'approved' then
        new.handled_by := (select auth.uid());
      end if;
    end if;

    return new;
  end if;

  -- ------------------------------------------------------------- UPDATE
  if v_role = 'student' then
    if old.status <> 'pending' or new.status <> 'cancelled'
       or (to_jsonb(new) - 'status' - 'updated_at' - 'updated_by')
          <> (to_jsonb(old) - 'status' - 'updated_at' - 'updated_by') then
      raise exception 'You can only cancel your own pending request.' using errcode = '42501';
    end if;
    return new;
  end if;

  if v_role = 'clinic_staff' then
    if new.status is distinct from old.status
       and not (
         (old.status = 'pending'  and new.status in ('approved', 'declined', 'cancelled'))
      or (old.status = 'approved' and new.status in ('cancelled', 'completed'))
       ) then
      raise exception 'An appointment cannot go from % to %.', old.status, new.status
        using errcode = '22023';
    end if;

    if old.status in ('declined', 'cancelled', 'completed')
       and new.scheduled_at is distinct from old.scheduled_at then
      raise exception 'A % appointment cannot be rescheduled.', old.status using errcode = '22023';
    end if;

    if old.status = 'approved' and new.status = 'approved'
       and new.scheduled_at is distinct from old.scheduled_at then
      new.reschedule_count := old.reschedule_count + 1;
    else
      new.reschedule_count := old.reschedule_count;
    end if;

    if new.status is distinct from old.status
       or new.scheduled_at is distinct from old.scheduled_at then
      new.handled_by := (select auth.uid());
    end if;
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_appointment_rules() from public, anon, authenticated;

create trigger enforce_appointment_rules before insert or update on public.appointments
  for each row execute function private.enforce_appointment_rules();
