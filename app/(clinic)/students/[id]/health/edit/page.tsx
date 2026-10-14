import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { updateHealthRecord } from "@/features/students/actions";
import { HealthRecordForm } from "@/features/students/components/health-record-form";
import { getHealthRecord, getStudent } from "@/features/students/queries";
import { requireRole } from "@/lib/auth/dal";
import { formatDateTime, studentName } from "@/lib/format";

export const metadata: Metadata = { title: "Edit health record" };

export default async function EditHealthRecordPage({ params }: PageProps<"/students/[id]/health/edit">) {
  await requireRole("clinic_staff");
  const { id } = await params;
  const [student, record] = await Promise.all([getStudent(id), getHealthRecord(id)]);
  if (!student || !record) notFound();

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Edit health record"
        description={
          <>
            {studentName(student)} · {student.student_number}
            {record.updater ? ` · Last updated by ${record.updater.full_name}, ${formatDateTime(record.updated_at)}` : null}
          </>
        }
      />
      <HealthRecordForm action={updateHealthRecord.bind(null, id)} record={record} cancelHref={`/students/${id}`} />
    </div>
  );
}
