import {
  CalendarClock,
  ChartColumn,
  Clock,
  GraduationCap,
  LayoutDashboard,
  Pill,
  Stethoscope,
  TriangleAlert,
  UserCog,
  UserCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import type { Role } from "@/lib/auth/roles";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  // Shows a waiting-items count next to the item.
  countKey?: "pendingAppointments" | "pendingRegistrations";
  // Shown only when student self-registration is enabled.
  registrationOnly?: boolean;
};

// SYSTEM_SPEC §6.2
const CLINIC_STAFF_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Students", href: "/students", icon: GraduationCap },
  { label: "Registrations", href: "/students/registrations", icon: UserCheck, countKey: "pendingRegistrations", registrationOnly: true },
  { label: "Visits", href: "/visits", icon: Stethoscope },
  { label: "Appointments", href: "/appointments", icon: CalendarClock, countKey: "pendingAppointments" },
  { label: "Medications", href: "/medications", icon: Pill },
  { label: "Incidents", href: "/incidents", icon: TriangleAlert },
  { label: "Reports", href: "/reports", icon: ChartColumn },
  { label: "Clinic Hours", href: "/settings/clinic-hours", icon: Clock },
  { label: "Account", href: "/account", icon: UserRound },
];

const ADMIN_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Reports", href: "/reports", icon: ChartColumn },
  { label: "Users", href: "/admin/users", icon: UserCog },
  { label: "Account", href: "/account", icon: UserRound },
];

export function navForRole(role: Role, registration = false): NavItem[] {
  if (role === "admin") return ADMIN_NAV;
  if (role === "clinic_staff") return CLINIC_STAFF_NAV.filter((i) => registration || !i.registrationOnly);
  return [];
}
