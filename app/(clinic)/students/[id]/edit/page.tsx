import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { updateStudent } from "@/features/students/actions";
import { StudentForm } from "@/features/students/components/student-form";
import { getStudent } from "@/features/students/queries";
import { requireRole } from "@/lib/auth/dal";
import { studentName } from "@/lib/format";

export const metadata: Metadata = { title: "Edit student" };

export default async function EditStudentPage({ params }: PageProps<"/students/[id]/edit">) {
  await requireRole("clinic_staff");
  const { id } = await params;
  const student = await getStudent(id);
  if (!student) notFound();

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Edit student"
        description={`${studentName(student)} · ${student.student_number}. Set the status to Inactive or Graduated to archive. Students are never deleted.`}
      />
      <StudentForm action={updateStudent.bind(null, id)} student={student} cancelHref={`/students/${id}`} />
    </div>
  );
}
