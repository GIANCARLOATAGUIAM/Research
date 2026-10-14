import type { Metadata } from "next";

import { PageHeader } from "@/components/app/page-header";
import { concernCategories, issuableMedicines } from "@/features/medications/queries";
import { StudentPicker } from "@/features/students/components/student-picker";
import { StudentSummary } from "@/features/students/components/student-summary";
import { getHealthRecord, getStudent } from "@/features/students/queries";
import { createVisit } from "@/features/visits/actions";
import { VisitForm } from "@/features/visits/components/visit-form";
import { param } from "@/components/app/list-controls";
import { requireRole } from "@/lib/auth/dal";
import { formatDateTime, nowManilaInput } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New visit" };

export default async function NewVisitPage({ searchParams }: PageProps<"/visits/new">) {
  await requireRole("clinic_staff");
  const sp = await searchParams;
  const studentId = param(sp, "student");
  const appointmentId = param(sp, "appointment");
  const student = studentId ? await getStudent(studentId) : null;

  if (!student) {
    return (
      <div className="grid gap-5">
        <PageHeader title="New visit" description="Record a clinic visit or consultation." />
        <StudentPicker path="/visits/new" q={param(sp, "q")} keep={{ appointment: appointmentId }} />
      </div>
    );
  }

  const supabase = await createClient();
  const [record, categories, medicines, appointment] = await Promise.all([
    getHealthRecord(student.id),
    concernCategories(),
    issuableMedicines(student.is_demo),
    appointmentId
      ? supabase
          .from("appointments")
          .select("id, status, scheduled_at, reason, student_id")
          .eq("id", appointmentId)
          .eq("student_id", student.id)
          .eq("status", "completed")
          .maybeSingle()
          .then((r) => r.data)
      : Promise.resolve(null),
  ]);

  return (
    <div className="grid gap-5">
      <PageHeader title="New visit" description="Record a clinic visit or consultation." />
      <StudentSummary student={student} record={record} changeHref="/visits/new" />
      {appointment ? (
        <p className="text-sm text-muted-foreground">
          Linked to the completed appointment scheduled {formatDateTime(appointment.scheduled_at)}: {appointment.reason}
        </p>
      ) : null}
      <VisitForm
        action={createVisit}
        defaults={{ visit_at: nowManilaInput(), reason: appointment?.reason ?? "" }}
        categories={categories.filter((c) => c.is_active)}
        medicines={medicines}
        hidden={{ student_id: student.id, ...(appointment ? { appointment_id: appointment.id } : {}) }}
        cancelHref={`/students/${student.id}`}
        submitLabel="Save visit"
      />
    </div>
  );
}
