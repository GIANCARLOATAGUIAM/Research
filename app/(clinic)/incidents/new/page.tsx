import type { Metadata } from "next";

import { param } from "@/components/app/list-controls";
import { PageHeader } from "@/components/app/page-header";
import { createIncident } from "@/features/incidents/actions";
import { IncidentForm } from "@/features/incidents/components/incident-form";
import { visitOptions } from "@/features/incidents/queries";
import { issuableMedicines } from "@/features/medications/queries";
import { StudentPicker } from "@/features/students/components/student-picker";
import { StudentSummary } from "@/features/students/components/student-summary";
import { getHealthRecord, getStudent } from "@/features/students/queries";
import { requireRole } from "@/lib/auth/dal";
import { nowManilaInput } from "@/lib/format";

export const metadata: Metadata = { title: "Record incident" };

export default async function NewIncidentPage({ searchParams }: PageProps<"/incidents/new">) {
  await requireRole("clinic_staff");
  const sp = await searchParams;
  const studentId = param(sp, "student");
  const student = studentId ? await getStudent(studentId) : null;

  if (!student) {
    return (
      <div className="grid gap-5">
        <PageHeader title="Record incident" description="Record an illness, injury, accident, or other incident." />
        <StudentPicker path="/incidents/new" q={param(sp, "q")} />
      </div>
    );
  }

  const [record, visits, medicines] = await Promise.all([
    getHealthRecord(student.id),
    visitOptions(student.id),
    issuableMedicines(student.is_demo),
  ]);
  const visitParam = param(sp, "visit");

  return (
    <div className="grid gap-5">
      <PageHeader title="Record incident" description="Record an illness, injury, accident, or other incident." />
      <StudentSummary student={student} record={record} changeHref="/incidents/new" />
      <IncidentForm
        action={createIncident}
        defaults={{ occurred_at: nowManilaInput(), clinic_visit_id: visits.some((v) => v.id === visitParam) ? visitParam : "" }}
        visits={visits}
        medicines={medicines}
        hidden={{ student_id: student.id }}
        cancelHref={`/students/${student.id}?tab=incidents`}
        submitLabel="Save incident"
      />
    </div>
  );
}
