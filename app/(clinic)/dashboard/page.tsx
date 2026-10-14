import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { DemoBadge } from "@/components/app/badges";
import { PageHeader } from "@/components/app/page-header";
import { expirySoonDate } from "@/features/medications/queries";
import { requireRole } from "@/lib/auth/dal";
import { ROLE_LABELS, ROLES } from "@/lib/auth/roles";
import { addDays, firstName, formatDateTime, formatLongDate, manilaDayStart, manilaToday, monthStart, studentName } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireRole("admin", "clinic_staff");

  return (
    <div className="grid gap-6">
      <PageHeader
        title={`Hello, ${firstName(user.fullName)}`}
        description={
          <>
            {formatLongDate(new Date())} · {ROLE_LABELS[user.role]}
          </>
        }
      />
      {user.role === "clinic_staff" ? <ClinicStaffDashboard /> : <AdminDashboard />}
    </div>
  );
}

function Stat({ label, value, href, tone }: { label: string; value: string | number; href?: string; tone?: "warning" | "danger" }) {
  const body = (
    <>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={cn(
          "text-2xl font-semibold tabular tracking-tight",
          tone === "warning" && "text-warning-foreground",
          tone === "danger" && "text-destructive"
        )}
      >
        {value}
      </span>
    </>
  );
  const cls = "grid gap-1 rounded-lg border bg-card px-4 py-3";
  return href ? (
    <Link href={href} className={cn(cls, "transition-colors hover:bg-muted/50")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

// FR-RPT-5, clinic personnel: operational counters (all records, demo included).
async function ClinicStaffDashboard() {
  const supabase = await createClient();
  const today = manilaToday();
  const dayStart = manilaDayStart(today);
  const dayEnd = manilaDayStart(addDays(today, 1));
  const soon = expirySoonDate();

  const [visitsToday, pending, todayAppts, incidentsMonth, meds] = await Promise.all([
    supabase.from("clinic_visits").select("id", { count: "exact", head: true }).gte("visit_at", dayStart).lt("visit_at", dayEnd),
    supabase.from("appointments").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase
      .from("appointments")
      .select("id, scheduled_at, reason, students(first_name, middle_name, last_name, is_demo)")
      .eq("status", "approved")
      .gte("scheduled_at", dayStart)
      .lt("scheduled_at", dayEnd)
      .order("scheduled_at"),
    supabase.from("health_incidents").select("id", { count: "exact", head: true }).gte("occurred_at", manilaDayStart(monthStart(today))),
    supabase.from("medicines").select("id, name, stock_quantity, reorder_level, expiration_date, unit, is_demo").eq("is_active", true),
  ]);

  const active = meds.data ?? [];
  const low = active.filter((m) => m.stock_quantity <= m.reorder_level);
  const expiring = active.filter((m) => m.expiration_date >= today && m.expiration_date <= soon);
  const expired = active.filter((m) => m.expiration_date < today);
  const attention = [
    ...expired.map((m) => ({ ...m, note: "Expired" })),
    ...expiring.map((m) => ({ ...m, note: "Expiring soon" })),
    ...low.filter((m) => m.expiration_date >= today).map((m) => ({ ...m, note: `Low stock: ${m.stock_quantity} ${m.unit}` })),
  ];

  return (
    <div className="grid gap-6">
      <section aria-labelledby="today-heading" className="grid gap-3">
        <h2 id="today-heading" className="text-sm font-medium">
          Today at the clinic
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="Visits today" value={visitsToday.count ?? 0} href={`/visits?from=${today}&to=${today}`} />
          <Stat label="Pending requests" value={pending.count ?? 0} href="/appointments" tone={pending.count ? "warning" : undefined} />
          <Stat label="Appointments today" value={todayAppts.data?.length ?? 0} href="/appointments?view=today" />
          <Stat label="Low stock" value={low.length} href="/medications?flag=low" tone={low.length ? "warning" : undefined} />
          <Stat label="Expiring in 30 days" value={expiring.length} href="/medications?flag=expiring" tone={expiring.length ? "warning" : undefined} />
          <Stat label="Incidents this month" value={incidentsMonth.count ?? 0} href={`/incidents?from=${monthStart(today)}`} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="grid content-start gap-2">
          <h2 className="text-sm font-medium">Today&apos;s appointments</h2>
          {todayAppts.data?.length ? (
            <ul className="divide-y rounded-lg border bg-card">
              {todayAppts.data.map((a) => (
                <li key={a.id}>
                  <Link href={`/appointments/${a.id}`} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50">
                    <span className="tabular text-muted-foreground">{formatDateTime(a.scheduled_at).split(", ").pop()}</span>
                    {a.students ? <span className="font-medium">{studentName(a.students)}</span> : null}
                    {a.students?.is_demo ? <DemoBadge /> : null}
                    <span className="truncate text-muted-foreground">{a.reason}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">No appointments scheduled today.</p>
          )}
        </section>

        <section className="grid content-start gap-2">
          <h2 className="text-sm font-medium">Medicines needing attention</h2>
          {attention.length ? (
            <ul className="divide-y rounded-lg border bg-card">
              {attention.slice(0, 8).map((m) => (
                <li key={`${m.id}-${m.note}`}>
                  <Link href={`/medications/${m.id}`} className="flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-muted/50">
                    <span className="flex items-center gap-1.5 font-medium">
                      {m.name}
                      {m.is_demo ? <DemoBadge /> : null}
                    </span>
                    <span className={cn("text-xs", m.note === "Expired" ? "text-destructive" : "text-warning-foreground")}>{m.note}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">All medicines are in stock and in date.</p>
          )}
        </section>
      </div>
    </div>
  );
}

// FR-RPT-5, administrator: aggregate counters only (real records, this month).
async function AdminDashboard() {
  const supabase = await createClient();
  const today = manilaToday();
  const args = { p_from: monthStart(today), p_to: today, p_scope: "real" };

  const [visits, incidents, appointments, profiles] = await Promise.all([
    supabase.rpc("report_visits", { ...args, p_period: "month" }),
    supabase.rpc("report_incidents", args),
    supabase.rpc("report_appointments", args),
    supabase.from("profiles").select("role").eq("is_active", true),
  ]);

  const show = (n: number | null | undefined) => (n === null ? "<5" : String(n ?? 0));
  const sum = (rows: { n: number | null }[]) => {
    const hidden = rows.some((r) => r.n === null);
    const total = rows.reduce((s, r) => s + (r.n ?? 0), 0);
    return rows.length === 0 ? "0" : hidden ? (total ? `${total}+` : "<5") : String(total);
  };
  const usersByRole = ROLES.map((r) => ({ role: r, count: (profiles.data ?? []).filter((p) => p.role === r).length }));

  return (
    <div className="grid gap-6">
      <section aria-labelledby="month-heading" className="grid gap-3">
        <h2 id="month-heading" className="text-sm font-medium">
          This month <span className="font-normal text-muted-foreground">· real records</span>
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Clinic visits" value={show(visits.data?.[0]?.visit_count)} href="/reports?report=visits" />
          <Stat label="Health incidents" value={sum((incidents.data ?? []).map((r) => ({ n: r.incident_count })))} href="/reports?report=incidents" />
          {(["pending", "approved", "completed"] as const).map((s) => (
            <Stat
              key={s}
              label={`Appointments ${s}`}
              value={show((appointments.data ?? []).find((r) => r.status === s)?.appointment_count ?? 0)}
              href="/reports?report=appointments"
            />
          ))}
        </div>
      </section>

      <section aria-labelledby="users-heading" className="grid gap-3">
        <h2 id="users-heading" className="text-sm font-medium">
          Active users
        </h2>
        <div className="grid grid-cols-3 gap-3 md:w-2/3">
          {usersByRole.map((u) => (
            <Stat key={u.role} label={ROLE_LABELS[u.role]} value={u.count} href={`/admin/users?role=${u.role}`} />
          ))}
        </div>
      </section>

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-px size-3.5 shrink-0" aria-hidden="true" />
        Administrators see summary counts only, and counts below 5 are shown as &lt;5. Individual student health records are
        visible to clinic personnel.
      </p>
    </div>
  );
}
