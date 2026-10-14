import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";

import { DemoBadge } from "@/components/app/badges";
import { DetailItem } from "@/components/app/fields";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getVisit } from "@/features/visits/queries";
import { requireRole } from "@/lib/auth/dal";
import { formatDateTime, studentName } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Visit" };

export default async function VisitPage({ params }: PageProps<"/visits/[id]">) {
  await requireRole("clinic_staff");
  const { id } = await params;
  const visit = await getVisit(id);
  if (!visit || !visit.students) notFound();
  const s = visit.students;

  const supabase = await createClient();
  const [{ data: meds }, { data: incidents }] = await Promise.all([
    supabase
      .from("medication_transactions")
      .select("id, quantity, created_at, medicine:medicines(id, name, unit)")
      .eq("clinic_visit_id", id)
      .order("created_at"),
    supabase.from("health_incidents").select("id, type, occurred_at").eq("clinic_visit_id", id),
  ]);

  return (
    <div className="grid gap-5">
      <PageHeader
        title={`Visit · ${formatDateTime(visit.visit_at)}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-1.5">
            <Link href={`/students/${s.id}`} className="font-medium text-foreground hover:underline">
              {studentName(s)}
            </Link>
            <span className="font-mono text-xs">{s.student_number}</span>
            {s.is_demo ? <DemoBadge /> : null}
          </span>
        }
        actions={
          <Button variant="outline" asChild>
            <Link href={`/visits/${id}/edit`}>
              <Pencil />
              Edit
            </Link>
          </Button>
        }
      />

      <dl className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2">
        <DetailItem label="Health concern">{visit.category?.name}</DetailItem>
        <DetailItem label="Attended by">{visit.attended?.full_name}</DetailItem>
        <DetailItem label="Reason for visit" className="sm:col-span-2">
          {visit.reason}
        </DetailItem>
        <DetailItem label="Symptoms">{visit.symptoms}</DetailItem>
        <DetailItem label="Assessment">{visit.assessment}</DetailItem>
        <DetailItem label="Treatment">{visit.treatment}</DetailItem>
        <DetailItem label="Follow-up instructions">{visit.follow_up_instructions}</DetailItem>
        {visit.appointment_id ? (
          <DetailItem label="Appointment">
            <Link href={`/appointments/${visit.appointment_id}`} className="text-primary hover:underline">
              View appointment
            </Link>
          </DetailItem>
        ) : null}
        {incidents?.length ? (
          <DetailItem label="Related incidents">
            {incidents.map((i) => (
              <Link key={i.id} href={`/incidents/${i.id}`} className="mr-3 text-primary capitalize hover:underline">
                {i.type}, {formatDateTime(i.occurred_at)}
              </Link>
            ))}
          </DetailItem>
        ) : null}
      </dl>

      <section className="grid gap-2">
        <h2 className="text-sm font-medium">Medication given</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Medicine</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {meds?.length ? (
              meds.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>
                    <Link href={`/medications/${m.medicine?.id}`} className="hover:underline">
                      {m.medicine?.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular">
                    {-m.quantity} {m.medicine?.unit}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={2} className="py-4 text-center text-muted-foreground">
                  No medication given during this visit.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <p className="text-xs text-muted-foreground">
          Issued medicines cannot be edited here. Correct stock with an adjustment on the medicine page.
        </p>
      </section>

      <p className="text-xs text-muted-foreground">
        Recorded {formatDateTime(visit.created_at)}
        {visit.updater ? ` · Last edited by ${visit.updater.full_name}, ${formatDateTime(visit.updated_at)}` : ""}
      </p>
    </div>
  );
}
