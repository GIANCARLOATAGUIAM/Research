import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/app/page-header";
import { concernCategories } from "@/features/medications/queries";
import { updateVisit } from "@/features/visits/actions";
import { VisitForm } from "@/features/visits/components/visit-form";
import { getVisit } from "@/features/visits/queries";
import { requireRole } from "@/lib/auth/dal";
import { studentName, toManilaInput } from "@/lib/format";

export const metadata: Metadata = { title: "Edit visit" };

export default async function EditVisitPage({ params }: PageProps<"/visits/[id]/edit">) {
  await requireRole("clinic_staff");
  const { id } = await params;
  const [visit, categories] = await Promise.all([getVisit(id), concernCategories()]);
  if (!visit || !visit.students) notFound();

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Edit visit"
        description={`${studentName(visit.students)} · ${visit.students.student_number}. Corrections are recorded with your name and the time.`}
      />
      <VisitForm
        action={updateVisit.bind(null, id)}
        defaults={{ ...visit, visit_at: toManilaInput(visit.visit_at) }}
        categories={categories.filter((c) => c.is_active || c.id === visit.concern_category_id)}
        cancelHref={`/visits/${id}`}
        submitLabel="Save changes"
      />
    </div>
  );
}
