import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { updateIncident } from "@/features/incidents/actions";
import { IncidentForm } from "@/features/incidents/components/incident-form";
import { getIncident, visitOptions } from "@/features/incidents/queries";
import { requireRole } from "@/lib/auth/dal";
import { studentName, toManilaInput } from "@/lib/format";

export const metadata: Metadata = { title: "Edit incident" };

export default async function EditIncidentPage({ params }: PageProps<"/incidents/[id]/edit">) {
  await requireRole("clinic_staff");
  const { id } = await params;
  const incident = await getIncident(id);
  if (!incident || !incident.students) notFound();
  const visits = await visitOptions(incident.student_id);

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Edit incident"
        description={`${studentName(incident.students)} · ${incident.students.student_number}. Medication given cannot be changed here.`}
      />
      <IncidentForm
        action={updateIncident.bind(null, id)}
        defaults={{ ...incident, occurred_at: toManilaInput(incident.occurred_at) }}
        visits={visits}
        cancelHref={`/incidents/${id}`}
        submitLabel="Save changes"
      />
    </div>
  );
}
