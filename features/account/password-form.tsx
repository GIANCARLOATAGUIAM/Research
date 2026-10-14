"use client";

import { useActionState, useEffect, useRef } from "react";

import { TextField } from "@/components/app/fields";
import { FormAlert, SubmitButton } from "@/components/app/form-status";
import { initialFormState } from "@/lib/forms";

import { changePassword } from "./actions";

export function PasswordForm() {
  const [state, formAction] = useActionState(changePassword, initialFormState);
  const ref = useRef<HTMLFormElement>(null);
  const e = state.fieldErrors ?? {};
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={formAction} noValidate className="grid max-w-sm gap-4">
      <FormAlert state={state} />
      <TextField name="current_password" label="Current password" type="password" autoComplete="current-password" required error={e.current_password} />
      <TextField
        name="new_password"
        label="New password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        error={e.new_password}
        hint="At least 8 characters."
      />
      <TextField name="confirm_password" label="Confirm new password" type="password" autoComplete="new-password" required error={e.confirm_password} />
      <div>
        <SubmitButton>Change password</SubmitButton>
      </div>
    </form>
  );
}
