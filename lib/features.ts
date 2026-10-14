import "server-only";

// Student self-registration (SYSTEM_SPEC §8.10) is off unless the server
// environment sets STUDENT_REGISTRATION=enabled. Turn it on only after
// migration 0010 is applied and Supabase Auth sign-ups are enabled; before
// that, sign-ups would create accounts that never receive a profile.
export function studentRegistrationEnabled() {
  return process.env.STUDENT_REGISTRATION === "enabled";
}
