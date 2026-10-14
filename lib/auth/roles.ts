// Roles from SYSTEM_SPEC.md §3. Must match the `user_role` enum created in Phase 2.
export const ROLES = ["admin", "clinic_staff", "student"] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrator",
  clinic_staff: "Clinic Personnel",
  student: "Student",
};

// Where each role lands after login.
export const ROLE_HOME: Record<Role, string> = {
  admin: "/dashboard",
  clinic_staff: "/dashboard",
  student: "/portal",
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}
