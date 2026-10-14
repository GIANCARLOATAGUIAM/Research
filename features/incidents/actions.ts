"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { parseMedicationRows } from "@/features/visits/schema";
import { requireRole } from "@/lib/auth/dal";
import { dbErrorMessage } from "@/lib/db-errors";
import { fromManilaInput } from "@/lib/format";
import { formValues, localDateTime, optionalText, optionalUuid, parseForm, requiredText, uuid, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

// SYSTEM_SPEC §4.7, DFD 6.1-6.4.
const incidentFields = z.object({
  occurred_at: localDateTime("date and time"),
  type: z.enum(["illness", "injury", "accident", "other"], { error: "Choose the incident type." }),
  location: optionalText(200),
  description: requiredText("Description", 2000),
  action_taken: requiredText("Action taken", 2000),
  clinic_visit_id: optionalUuid,
});

const newIncidentSchema = incidentFields.extend({ student_id: uuid("student") });

// Saves the incident and any medication in one transaction
// (create_incident_with_medications). A linked visit must belong to the
// same student; the database enforces this.
export async function createIncident(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("clinic_staff");
  const parsed = parseForm(newIncidentSchema, formData);
  if (parsed.state) return parsed.state;
  const meds = parseMedicationRows(formData);
  if (meds.error) return { error: meds.error, values: formValues(formData) };

  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("create_incident_with_medications", {
    p_incident: { ...parsed.data, occurred_at: fromManilaInput(parsed.data.occurred_at) },
    p_items: meds.items,
  });
  if (error) return { error: dbErrorMessage(error), values: formValues(formData) };

  revalidatePath("/incidents");
  revalidatePath("/medications");
  revalidatePath(`/students/${parsed.data.student_id}`);
  redirect(`/incidents/${id}`);
}

export async function updateIncident(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("clinic_staff");
  const parsed = parseForm(incidentFields, formData);
  if (parsed.state) return parsed.state;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("health_incidents")
    .update({ ...parsed.data, occurred_at: fromManilaInput(parsed.data.occurred_at) })
    .eq("id", id)
    .select("student_id");
  if (error) return { error: dbErrorMessage(error), values: formValues(formData) };
  if (!data.length) return { error: "Incident not found." };

  revalidatePath("/incidents");
  revalidatePath(`/incidents/${id}`);
  revalidatePath(`/students/${data[0].student_id}`);
  redirect(`/incidents/${id}`);
}
