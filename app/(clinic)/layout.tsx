import { ClinicShell } from "@/components/app/clinic-shell";
import { Disclaimer } from "@/components/app/disclaimer";
import { requireRole } from "@/lib/auth/dal";
import { studentRegistrationEnabled } from "@/lib/features";
import { createClient } from "@/lib/supabase/server";

// Shell for administrators and clinic personnel. Layouts do not re-run on
// client navigation, so every page under this group must call requireRole()
// itself. This check only loads the user for the sidebar.
export default async function ClinicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("admin", "clinic_staff");

  const registration = studentRegistrationEnabled();
  let pendingAppointments: number | undefined;
  let pendingRegistrations: number | undefined;
  if (user.role === "clinic_staff") {
    const supabase = await createClient();
    const [appointments, registrations] = await Promise.all([
      supabase.from("appointments").select("id", { count: "exact", head: true }).eq("status", "pending"),
      registration
        ? supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("role", "student")
            .eq("is_active", true)
            .is("student_id", null)
        : Promise.resolve({ count: null }),
    ]);
    pendingAppointments = appointments.count ?? undefined;
    pendingRegistrations = registrations.count ?? undefined;
  }

  return (
    <ClinicShell
      user={{ fullName: user.fullName, email: user.email, role: user.role }}
      counts={{ pendingAppointments, pendingRegistrations }}
      registration={registration}
    >
      <div className="flex flex-1 flex-col">
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8 print:max-w-none print:p-0">
          {children}
        </main>
        <footer className="mx-auto w-full max-w-6xl px-4 pb-6 sm:px-6 lg:px-8 print:hidden">
          <Disclaimer className="border-t pt-4" />
        </footer>
      </div>
    </ClinicShell>
  );
}
