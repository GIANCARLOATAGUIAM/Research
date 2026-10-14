import Link from "next/link";
import { TriangleAlert } from "lucide-react";

import { DemoBadge, StudentStatusBadge } from "@/components/app/badges";
import { studentName } from "@/lib/format";
import type { Tables } from "@/types/database";

// Compact student header for visit, incident, and appointment forms.
// Shows allergies and conditions so they are seen before treatment (FR-HR-4).
export function StudentSummary({
  student,
  record,
  changeHref,
}: {
  student: Tables<"students">;
  record?: Pick<Tables<"health_records">, "allergies" | "existing_conditions"> | null;
  changeHref?: string;
}) {
  const alerts = [
    record?.allergies ? `Allergies: ${record.allergies}` : null,
    record?.existing_conditions ? `Conditions: ${record.existing_conditions}` : null,
  ].filter(Boolean);

  return (
    <div className="grid gap-2 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/students/${student.id}`} className="font-medium hover:underline">
          {studentName(student)}
        </Link>
        <span className="font-mono text-xs text-muted-foreground">{student.student_number}</span>
        {student.is_demo ? <DemoBadge /> : null}
        <StudentStatusBadge status={student.status} />
        {changeHref ? (
          <Link href={changeHref} className="ml-auto text-xs text-primary hover:underline">
            Change student
          </Link>
        ) : null}
      </div>
      {alerts.length ? (
        <ul className="grid gap-1 rounded-md bg-warning/12 px-3 py-2 text-sm">
          {alerts.map((a) => (
            <li key={a} className="flex items-start gap-2">
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning-foreground" />
              <span className="whitespace-pre-line">{a}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No recorded allergies or existing conditions.</p>
      )}
    </div>
  );
}
