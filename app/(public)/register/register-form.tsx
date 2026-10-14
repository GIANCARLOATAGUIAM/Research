"use client";

import Link from "next/link";
import { useActionState } from "react";

import { TextField } from "@/components/app/fields";
import { FormAlert, SubmitButton } from "@/components/app/form-status";
import { registerStudent } from "@/features/registration/actions";
import { initialFormState } from "@/lib/forms";

export function RegisterForm() {
  const [state, formAction] = useActionState(registerStudent, initialFormState);
  const e = state.fieldErrors ?? {};
  const v = (k: string) => state.values?.[k] ?? "";

  if (state.ok) {
    return (
      <div className="grid gap-4">
        <FormAlert state={state} />
        <Link href="/login" className="text-sm text-primary hover:underline">
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} noValidate className="grid gap-5">
      <FormAlert state={state} />
      <TextField name="email" label="Email" type="email" autoComplete="email" inputMode="email" required defaultValue={v("email")} error={e.email} className="[&_input]:h-9" />
      <TextField
        name="student_number"
        label="Student number"
        required
        autoComplete="off"
        maxLength={40}
        defaultValue={v("student_number")}
        error={e.student_number}
        hint="As shown on your school ID. The clinic uses it to find your record."
        className="[&_input]:h-9"
      />
      <TextField name="password" label="Password" type="password" autoComplete="new-password" required minLength={8} error={e.password} hint="At least 8 characters." className="[&_input]:h-9" />
      <TextField name="confirm_password" label="Confirm password" type="password" autoComplete="new-password" required error={e.confirm_password} className="[&_input]:h-9" />
      <SubmitButton size="lg" className="w-full" pendingLabel="Creating account…">
        Create student account
      </SubmitButton>
    </form>
  );
}
