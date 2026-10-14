"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/dal";
import { dbErrorMessage } from "@/lib/db-errors";
import { fromManilaInput } from "@/lib/format";
import { formValues, parseForm, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

import { newVisitSchema, parseMedicationRows, visitFieldsSchema } from "./schema";

// Saves the visit and every medication row in one database transaction
// (create_visit_with_medications). If any row fails, nothing is saved.
export async function createVisit(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("clinic_staff");
  const parsed = parseForm(newVisitSchema, formData);
  if (parsed.state) return parsed.state;
  const meds = parseMedicationRows(formData);
  if (meds.error) return { error: meds.error, values: formValues(formData) };

  const { visit_at, ...rest } = parsed.data;
  const supabase = await createClient();
  const { data: visitId, error } = await supabase.rpc("create_visit_with_medications", {
    p_visit: { ...rest, visit_at: fromManilaInput(visit_at) },
    p_items: meds.items,
  });

  if (error) return { error: dbErrorMessage(error), values: formValues(formData) };

  revalidatePath("/visits");
  revalidatePath("/medications");
  revalidatePath(`/students/${parsed.data.student_id}`);
  redirect(`/visits/${visitId}`);
}

// Corrections to the visit record. Issued medicines cannot be changed here;
// stock corrections go through an inventory adjustment (PLAN.md Phase 4).
export async function updateVisit(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("clinic_staff");
  const parsed = parseForm(visitFieldsSchema, formData);
  if (parsed.state) return parsed.state;

  const supabase = await createClient();
  const { data: category } = await supabase
    .from("health_concern_categories")
    .select("id")
    .eq("id", parsed.data.concern_category_id)
    .maybeSingle();
  if (!category) {
    return { error: "Please correct the highlighted fields.", fieldErrors: { concern_category_id: "Choose a health concern." }, values: formValues(formData) };
  }

  const { data, error } = await supabase
    .from("clinic_visits")
    .update({ ...parsed.data, visit_at: fromManilaInput(parsed.data.visit_at) })
    .eq("id", id)
    .select("student_id");

  if (error) return { error: dbErrorMessage(error), values: formValues(formData) };
  if (!data.length) return { error: "Visit not found.", values: formValues(formData) };

  revalidatePath("/visits");
  revalidatePath(`/visits/${id}`);
  revalidatePath(`/students/${data[0].student_id}`);
  redirect(`/visits/${id}`);
}
