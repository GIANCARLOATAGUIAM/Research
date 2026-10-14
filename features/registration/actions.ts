"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireRole } from "@/lib/auth/dal";
import { dbErrorMessage } from "@/lib/db-errors";
import { studentRegistrationEnabled } from "@/lib/features";
import { formValues, parseForm, requiredText, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

const registerSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email({ error: "Enter a valid email address." })),
    student_number: requiredText("Student number", 40),
    password: z.string().min(8, { error: "Use at least 8 characters." }).max(72, { error: "Use 72 characters or fewer." }),
    confirm_password: z.string(),
  })
  .refine((v) => v.password === v.confirm_password, { path: ["confirm_password"], error: "Passwords do not match." });

// SYSTEM_SPEC §8.10. The Student ID goes into user_metadata, which grants
// nothing: the database creates a pending `student` profile (migration
// 0010) and clinic staff approve the link to a student record.
export async function registerStudent(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!studentRegistrationEnabled()) return { error: "Student registration is not open." };

  const parsed = parseForm(registerSchema, formData);
  const keep = (v: Record<string, string> | undefined) => ({ ...v, password: "", confirm_password: "" });
  if (parsed.state) return { ...parsed.state, values: keep(parsed.state.values) };

  const h = await headers();
  const origin = h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { student_number: parsed.data.student_number },
      emailRedirectTo: `${origin}/auth/confirm?next=/portal`,
    },
  });

  if (error) {
    const values = keep(formValues(formData));
    if (/already registered|already exists/i.test(error.message)) {
      return { error: "This email cannot be used to register. If you already have an account, sign in instead.", values };
    }
    if (/password/i.test(error.message)) {
      return { error: "Please correct the highlighted fields.", fieldErrors: { password: error.message }, values };
    }
    if (/signups? not allowed|disabled/i.test(error.message)) {
      return { error: "Student registration is not open yet.", values };
    }
    console.error("[register] signUp failed:", error.message);
    return { error: "Could not create the account. Please try again later.", values };
  }

  // "Confirm email" off: the user is signed in at once and lands on the
  // portal, which shows "Waiting for clinic approval".
  if (data.session) redirect("/portal");

  return {
    ok: true,
    message: "Check your email and open the confirmation link. After that, the clinic will verify your student record.",
  };
}

const approveSchema = z.object({ student_number: requiredText("Student number", 40) });

// Clinic staff link a pending self-registered account to an existing student
// record after checking the student's identity (approve_student_link).
export async function approveRegistration(profileId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole("clinic_staff");
  const parsed = parseForm(approveSchema, formData);
  if (parsed.state) return parsed.state;

  const supabase = await createClient();
  const { data: student } = await supabase
    .from("students")
    .select("id")
    .eq("student_number", parsed.data.student_number)
    .maybeSingle();
  if (!student) {
    return { error: "No student record has this student number. Add the student first.", values: formValues(formData) };
  }

  const { error } = await supabase.rpc("approve_student_link", { p_profile_id: profileId, p_student_id: student.id });
  if (error) return { error: dbErrorMessage(error), values: formValues(formData) };

  revalidatePath("/", "layout");
  return { ok: true, message: "Account approved and linked." };
}
