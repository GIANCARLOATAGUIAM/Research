"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireRole } from "@/lib/auth/dal";
import { dbErrorMessage, isUniqueViolation } from "@/lib/db-errors";
import { formValues, parseForm, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

import { healthRecordSchema, studentSchema } from "./schema";

function duplicateNumber(formData: FormData): FormState {
  return {
    error: "Please correct the highlighted fields.",
    fieldErrors: { student_number: "This student number is already registered." },
    values: formValues(formData),
  };
}

export async function createStudent(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("clinic_staff");
  const parsed = parseForm(studentSchema, formData);
  if (parsed.state) return parsed.state;

  // Records created in the app are always real; DEMO- is reserved for seeded
  // demo data (SYSTEM_SPEC §11).
  if (/^demo-/i.test(parsed.data.student_number)) {
    return {
      error: "Please correct the highlighted fields.",
      fieldErrors: { student_number: "Numbers starting with DEMO- are reserved for demo records." },
      values: formValues(formData),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("students").insert(parsed.data).select("id").single();

  if (error) {
    if (isUniqueViolation(error, "students_student_number_key")) return duplicateNumber(formData);
    return { error: dbErrorMessage(error), values: formValues(formData) };
  }

  revalidatePath("/students");
  redirect(`/students/${data.id}`);
}

export async function updateStudent(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("clinic_staff");
  const parsed = parseForm(studentSchema, formData);
  if (parsed.state) return parsed.state;

  const supabase = await createClient();
  const { data, error } = await supabase.from("students").update(parsed.data).eq("id", id).select("id");

  if (error) {
    if (isUniqueViolation(error, "students_student_number_key")) return duplicateNumber(formData);
    if (error.message.includes("students_demo_prefix")) {
      return {
        error: "Please correct the highlighted fields.",
        fieldErrors: { student_number: "Demo records must keep a DEMO- number, and real records cannot use one." },
        values: formValues(formData),
      };
    }
    return { error: dbErrorMessage(error), values: formValues(formData) };
  }
  if (!data.length) return { error: "Student not found.", values: formValues(formData) };

  revalidatePath("/students");
  revalidatePath(`/students/${id}`);
  redirect(`/students/${id}`);
}

export async function updateHealthRecord(studentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("clinic_staff");
  const parsed = parseForm(healthRecordSchema, formData);
  if (parsed.state) return parsed.state;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("health_records")
    .update(parsed.data)
    .eq("student_id", studentId)
    .select("id");

  if (error) return { error: dbErrorMessage(error), values: formValues(formData) };
  if (!data.length) return { error: "Health record not found.", values: formValues(formData) };

  revalidatePath(`/students/${studentId}`);
  redirect(`/students/${studentId}`);
}
