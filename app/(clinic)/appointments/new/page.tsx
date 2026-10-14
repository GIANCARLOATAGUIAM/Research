import type { Metadata } from "next";

import { param } from "@/components/app/list-controls";
import { PageHeader } from "@/components/app/page-header";
import { bookAppointment } from "@/features/appointments/actions";
import { RequestForm } from "@/features/appointments/components/request-form";
import { StudentPicker } from "@/features/students/components/student-picker";
import { StudentSummary } from "@/features/students/components/student-summary";
import { getHealthRecord, getStudent } from "@/features/students/queries";
import { requireRole } from "@/lib/auth/dal";
import { manilaToday } from "@/lib/format";

export const metadata: Metadata = { title: "Book appointment" };

// FR-APT-2: clinic personnel book an appointment for a student. It is saved
// as approved at the chosen date and time; staff hours are not restricted.
export default async function NewAppointmentPage({ searchParams }: PageProps<"/appointments/new">) {
  await requireRole("clinic_staff");
  const sp = await searchParams;
  const studentId = param(sp, "student");
  const student = studentId ? await getStudent(studentId) : null;

  return (
    <div className="grid gap-5">
      <PageHeader title="Book appointment" description="Schedule an appointment for a student, for example after a phone call." />
      {student ? (
        <>
          <StudentSummary student={student} record={await getHealthRecord(student.id)} changeHref="/appointments/new" />
          <RequestForm
            action={bookAppointment}
            hidden={{ student_id: student.id }}
            minDate={manilaToday()}
            cancelHref="/appointments"
            submitLabel="Book appointment"
          />
        </>
      ) : (
        <StudentPicker path="/appointments/new" q={param(sp, "q")} />
      )}
    </div>
  );
}
