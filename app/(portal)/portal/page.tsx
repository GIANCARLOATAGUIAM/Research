import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, CalendarPlus, Hourglass } from "lucide-react";

import { ActionForm } from "@/components/app/action-form";
import { AppointmentStatusBadge } from "@/components/app/badges";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { cancelMyAppointment } from "@/features/appointments/actions";
import { requireRole } from "@/lib/auth/dal";
import { firstName, formatDate, formatDateTime, formatTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My appointments" };

export default async function PortalPage() {
  const user = await requireRole("student");
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("student_id").eq("id", user.id).maybeSingle();

  if (!profile?.student_id) {
    return (
      <div className="grid gap-6">
        <PageHeader title="My appointments" />
        <EmptyState icon={Hourglass} title="Waiting for clinic approval">
          Your account is not linked to your student record yet. The clinic will verify your details. You can request
          appointments after that.
        </EmptyState>
      </div>
    );
  }

  // RLS returns only this student's appointments.
  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, preferred_date, preferred_time, scheduled_at, status, reason, staff_remarks, reschedule_count, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  const hasPending = appointments?.some((a) => a.status === "pending");

  return (
    <div className="grid gap-6">
      <PageHeader
        title="My appointments"
        description={`Hello, ${firstName(user.fullName)}. Request a clinic appointment and check its status here.`}
        actions={
          hasPending ? (
            <Button disabled title="You already have a pending request">
              <CalendarPlus />
              Request appointment
            </Button>
          ) : (
            <Button asChild>
              <Link href="/portal/request">
                <CalendarPlus />
                Request appointment
              </Link>
            </Button>
          )
        }
      />

      {hasPending ? (
        <p className="text-sm text-muted-foreground">
          You have a pending request. You can send another one after the clinic responds or after you cancel it.
        </p>
      ) : null}

      {appointments?.length ? (
        <ul className="grid gap-3">
          {appointments.map((a) => (
            <li key={a.id} className="grid gap-2 rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  {a.scheduled_at && (a.status === "approved" || a.status === "completed")
                    ? formatDateTime(a.scheduled_at)
                    : `${formatDate(a.preferred_date)}, ${formatTime(a.preferred_time)}`}
                </p>
                <AppointmentStatusBadge status={a.status} />
              </div>
              <p className="text-sm text-muted-foreground">{a.reason}</p>
              {a.status === "approved" && a.reschedule_count > 0 ? (
                <p className="text-xs text-muted-foreground">Rescheduled by the clinic.</p>
              ) : null}
              {a.staff_remarks ? (
                <p className="rounded-md bg-muted px-3 py-2 text-sm">
                  <span className="font-medium">Clinic remarks: </span>
                  {a.staff_remarks}
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Requested {formatDateTime(a.created_at)} for {formatDate(a.preferred_date)}, {formatTime(a.preferred_time)}
              </p>
              {a.status === "pending" ? (
                <ActionForm
                  action={cancelMyAppointment.bind(null, a.id)}
                  submitLabel="Cancel request"
                  pendingLabel="Cancelling…"
                  variant="outline"
                  confirm={{ message: "Cancel this request?", confirmLabel: "Yes, cancel request" }}
                />
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState icon={CalendarClock} title="No appointments yet">
          Your requests will appear here with their status and any remarks from the clinic.
        </EmptyState>
      )}
    </div>
  );
}
