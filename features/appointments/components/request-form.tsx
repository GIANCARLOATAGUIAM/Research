"use client";

import { useActionState } from "react";

import { TextAreaField, TextField } from "@/components/app/fields";
import { FormAlert } from "@/components/app/form-status";
import { FormActions } from "@/features/students/components/student-form";
import { initialFormState, type FormState } from "@/lib/forms";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

// Student appointment request (FR-APT-1). The browser limits match the
// clinic hours; the database checks them again.
export function RequestForm({
  action,
  minDate,
  maxDate,
  openTime,
  closeTime,
  hoursText,
  cancelHref,
  submitLabel = "Send request",
  hidden = {},
}: {
  action: Action;
  minDate?: string;
  maxDate?: string;
  openTime?: string;
  closeTime?: string;
  hoursText?: string;
  cancelHref: string;
  submitLabel?: string;
  hidden?: Record<string, string>;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const e = state.fieldErrors ?? {};
  const v = (k: string) => state.values?.[k] ?? "";

  return (
    <form action={formAction} noValidate className="grid max-w-xl gap-5">
      <FormAlert state={state} />
      {Object.entries(hidden).map(([k, val]) => (
        <input key={k} type="hidden" name={k} value={val} />
      ))}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="preferred_date"
          label="Preferred date"
          type="date"
          required
          min={minDate}
          max={maxDate}
          defaultValue={v("preferred_date")}
          error={e.preferred_date}
          hint={hoursText}
        />
        <TextField
          name="preferred_time"
          label="Preferred time"
          type="time"
          required
          min={openTime}
          max={closeTime}
          step={900}
          defaultValue={v("preferred_time")}
          error={e.preferred_time}
        />
      </div>
      <TextAreaField name="reason" label="Reason" required rows={3} defaultValue={v("reason")} error={e.reason} />
      <FormActions cancelHref={cancelHref} submitLabel={submitLabel} />
    </form>
  );
}
