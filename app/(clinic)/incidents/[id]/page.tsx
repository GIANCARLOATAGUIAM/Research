import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";

import { DemoBadge } from "@/components/app/badges";
import { DetailItem } from "@/components/app/fields";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getIncident } from "@/features/incidents/queries";
import { requireRole } from "@/lib/auth/dal";
import { formatDateTime, studentName } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Incident" };

export default async function IncidentPage({ params }: PageProps<"/incidents/[id]">) {
  await requireRole("clinic_staff");
  const { id } = await params;
  const incident = await getIncident(id);
  if (!incident || !incident.students) notFound();
  const s = incident.students;

  const supabase = await createClient();
  const { data: meds } = await supabase
    .from("medication_transactions")
    .select("id, quantity, medicine:medicines(id, name, unit)")
    .eq("incident_id", id)
    .order("created_at");

  return (
    <div className="grid gap-5">
      <PageHeader
        title={`${incident.type.charAt(0).toUpperCase()}${incident.type.slice(1)} · ${formatDateTime(incident.occurred_at)}`}
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
            <Link href={`/incidents/${id}/edit`}>
              <Pencil />
              Edit
            </Link>
          </Button>
        }
      />

      <dl className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2">
        <DetailItem label="Location">{incident.location}</DetailItem>
        <DetailItem label="Recorded by">{incident.recorder?.full_name}</DetailItem>
        <DetailItem label="What happened" className="sm:col-span-2">
          {incident.description}
        </DetailItem>
        <DetailItem label="Action taken" className="sm:col-span-2">
          {incident.action_taken}
        </DetailItem>
        <DetailItem label="Related clinic visit">
          {incident.clinic_visit_id ? (
            <Link href={`/visits/${incident.clinic_visit_id}`} className="text-primary hover:underline">
              View visit
            </Link>
          ) : null}
        </DetailItem>
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
                  No medication given for this incident.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </section>

      <p className="text-xs text-muted-foreground">
        Recorded {formatDateTime(incident.created_at)}
        {incident.updater ? ` · Last edited by ${incident.updater.full_name}, ${formatDateTime(incident.updated_at)}` : ""}
      </p>
    </div>
  );
}
