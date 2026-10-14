import type { Metadata } from "next";

import { PageHeader } from "@/components/app/page-header";
import { createStudent } from "@/features/students/actions";
import { StudentForm } from "@/features/students/components/student-form";
import { requireRole } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Add student" };

export default async function NewStudentPage() {
  await requireRole("clinic_staff");

  return (
    <div className="grid gap-5">
      <PageHeader title="Add student" description="An empty health record is created with the profile." />
      <StudentForm action={createStudent} cancelHref="/students" />
    </div>
  );
}
