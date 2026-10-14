import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FilePlus2 } from "lucide-react";

import { ActionForm } from "@/components/app/action-form";
import { AppointmentStatusBadge, DemoBadge } from "@/components/app/badges";
import { DetailItem, TextAreaField, TextField } from "@/components/app/fields";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { updateAppointmentStatus } from "@/features/appointments/actions";
import { requireRole } from "@/lib/auth/dal";
import { formatDate, formatDateTime, formatTime, studentName, toManilaInput } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Appointment" };

export default async function AppointmentPage({ params }: PageProps<"/appointments/[id]">) {
  await requireRole("clinic_staff");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: a }, { data: visit }] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        "*, students(id, student_number, first_name, middle_name, last_name, is_demo), requester:profiles!appointments_requested_by_fkey(full_name, role), handler:profiles!appointments_handled_by_fkey(full_name)"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase.from("clinic_visits").select("id").eq("appointment_id", id).maybeSingle(),
  ]);
  if (!a || !a.students) notFound();
  const s = a.students;
  const preferredLocal = `${a.preferred_date}T${a.preferred_time.slice(0, 5)}`;
  const act = (intent: Parameters<typeof updateAppointmentStatus>[1]) => updateAppointmentStatus.bind(null, id, intent);

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Appointment"
        description={
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <Link href={`/students/${s.id}`} className="font-medium text-foreground hover:underline">
              {studentName(s)}
            </Link>
            <span className="font-mono text-xs">{s.student_number}</span>
            {s.is_demo ? <DemoBadge /> : null}
          </span>
        }
        actions={<AppointmentStatusBadge status={a.status} />}
      />

      <dl className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
        <DetailItem label="Requested for">
          {formatDate(a.preferred_date)}, {formatTime(a.preferred_time)}
        </DetailItem>
        <DetailItem label="Schedule">{a.scheduled_at ? formatDateTime(a.scheduled_at) : null}</DetailItem>
        <DetailItem label="Reschedules">{String(a.reschedule_count)}</DetailItem>
        <DetailItem label="Reason" className="sm:col-span-2 lg:col-span-3">
          {a.reason}
        </DetailItem>
        <DetailItem label="Remarks to student" className="sm:col-span-2 lg:col-span-3">
          {a.staff_remarks}
        </DetailItem>
        <DetailItem label="Requested by">
          {a.requester ? `${a.requester.full_name}${a.requester.role === "student" ? " (student)" : ""}` : null}, {formatDateTime(a.created_at)}
        </DetailItem>
        <DetailItem label="Handled by">{a.handler?.full_name}</DetailItem>
      </dl>

      {a.status === "pending" ? (
        <div className="grid gap-4 md:grid-cols-2">
          <ActionPanel title="Approve">
            <ActionForm action={act("approve")} submitLabel="Approve">
              <TextField name="scheduled_at" label="Schedule" type="datetime-local" required defaultValue={preferredLocal} />
              <TextAreaField name="staff_remarks" label="Remarks (optional)" rows={2} />
            </ActionForm>
          </ActionPanel>
          <ActionPanel title="Decline">
            <ActionForm action={act("decline")} submitLabel="Decline" variant="outline">
              <TextAreaField name="staff_remarks" label="Reason for declining" required rows={2} />
            </ActionForm>
          </ActionPanel>
        </div>
      ) : null}

      {a.status === "approved" ? (
        <div className="grid gap-4 md:grid-cols-3">
          <ActionPanel title="Attended">
            <p className="text-sm text-muted-foreground">Mark as completed after the student visits. You can then record the visit.</p>
            <ActionForm action={act("complete")} submitLabel="Mark completed" />
          </ActionPanel>
          <ActionPanel title="Reschedule">
            <ActionForm action={act("reschedule")} submitLabel="Reschedule" variant="outline">
              <TextField
                name="scheduled_at"
                label="New schedule"
                type="datetime-local"
                required
                defaultValue={a.scheduled_at ? toManilaInput(a.scheduled_at) : preferredLocal}
              />
              <TextAreaField name="staff_remarks" label="Remark for the student" required rows={2} />
            </ActionForm>
          </ActionPanel>
          <ActionPanel title="Cancel">
            <ActionForm
              action={act("cancel")}
              submitLabel="Cancel appointment"
              variant="destructive"
              confirm={{ message: "Cancel this appointment? The student will see it as cancelled.", confirmLabel: "Yes, cancel appointment" }}
            >
              <TextAreaField name="staff_remarks" label="Reason (optional)" rows={2} />
            </ActionForm>
          </ActionPanel>
        </div>
      ) : null}

      {a.status === "completed" ? (
        visit ? (
          <p className="text-sm">
            Visit recorded.{" "}
            <Link href={`/visits/${visit.id}`} className="text-primary hover:underline">
              View visit
            </Link>
          </p>
        ) : (
          <div>
            <Button asChild>
              <Link href={`/visits/new?student=${s.id}&appointment=${id}`}>
                <FilePlus2 />
                Record visit
              </Link>
            </Button>
          </div>
        )
      ) : null}
    </div>
  );
}

function ActionPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid content-start gap-3 rounded-lg border bg-card p-4">
      <h2 className="text-sm font-medium">{title}</h2>
      {children}
    </section>
  );
}
