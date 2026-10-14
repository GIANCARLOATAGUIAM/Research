"use server";

import { z } from "zod";

import { getAuthState } from "@/lib/auth/dal";
import { parseForm, type FormState } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

const schema = z
  .object({
    current_password: z.string().min(1, { error: "Enter your current password." }),
    new_password: z.string().min(8, { error: "Use at least 8 characters." }).max(72, { error: "Use 72 characters or fewer." }),
    confirm_password: z.string(),
  })
  .refine((v) => v.new_password === v.confirm_password, { path: ["confirm_password"], error: "Passwords do not match." })
  .refine((v) => v.new_password !== v.current_password, { path: ["new_password"], error: "Choose a new password." });

// FR-AUTH-7: any active user changes their own password. The current
// password is checked first.
export async function changePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const state = await getAuthState();
  if (state.status !== "ok") return { error: "Please sign in again." };

  const parsed = parseForm(schema, formData);
  if (parsed.state) return { ...parsed.state, values: {} };

  const supabase = await createClient();
  const { error: checkError } = await supabase.auth.signInWithPassword({
    email: state.user.email,
    password: parsed.data.current_password,
  });
  if (checkError) {
    return { error: "Please correct the highlighted fields.", fieldErrors: { current_password: "Current password is incorrect." } };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.new_password });
  if (error) {
    console.error("[account] password change failed:", error.message);
    return { error: /password/i.test(error.message) ? error.message : "Could not change the password. Try again." };
  }
  return { ok: true, message: "Password changed." };
}
