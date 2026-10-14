-- WUPCare 0009: fix account provisioning trigger.
-- Spec: SYSTEM_SPEC.md §8.8; docs/AUTH_PROVISIONING.md §2.
--
-- Live finding (2026-10-14): Supabase Auth's admin createUser inserts the
-- auth.users row with default app_metadata, then writes the custom
-- app_metadata in a separate UPDATE. The 0003 AFTER INSERT trigger never saw
-- wupcare_role, so no profile was created and invalid roles were not
-- rejected.
--
-- The trigger now also fires when raw_app_meta_data changes. It creates the
-- profile only if none exists yet; an existing profile is never changed
-- here, so public.profiles stays the only source of role and status.
-- app_metadata can still only be written with the service-role key.

create or replace function private.handle_new_auth_user()
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
    )
    on conflict (id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;

drop trigger on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of raw_app_meta_data on auth.users
  for each row execute function private.handle_new_auth_user();
