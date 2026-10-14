"use client";

import Link from "next/link";
import { useActionState } from "react";

import { SelectField, TextAreaField, TextField } from "@/components/app/fields";
import { FormAlert, SubmitButton } from "@/components/app/form-status";
import { Button } from "@/components/ui/button";
import { initialFormState, type FormState } from "@/lib/forms";
import type { Tables } from "@/types/database";

import { STATUS_OPTIONS, YEAR_OPTIONS } from "../schema";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export function StudentForm({
  action,
  student,
  cancelHref,
}: {
  action: Action;
  student?: Tables<"students">;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const e = state.fieldErrors ?? {};
  // After a failed submit, show what the user typed; otherwise the saved record.
  const v = (key: keyof Tables<"students">) =>
    state.values?.[key] ?? (student?.[key] == null ? "" : String(student[key]));

  return (
    <form action={formAction} noValidate className="grid gap-6">
      <FormAlert state={state} />

      <Section title="Student">
        <TextField name="student_number" label="Student number" required maxLength={40} defaultValue={v("student_number")} error={e.student_number} />
        <SelectField name="status" label="Status" required defaultValue={v("status") || "active"} options={STATUS_OPTIONS} error={e.status} />
        <TextField name="last_name" label="Last name" required maxLength={80} autoComplete="off" defaultValue={v("last_name")} error={e.last_name} />
        <TextField name="first_name" label="First name" required maxLength={80} autoComplete="off" defaultValue={v("first_name")} error={e.first_name} />
        <TextField name="middle_name" label="Middle name" maxLength={80} autoComplete="off" defaultValue={v("middle_name")} error={e.middle_name} />
        <SelectField
          name="sex"
          label="Sex"
          defaultValue={v("sex")}
          placeholder="Not specified"
          options={[
            { value: "female", label: "Female" },
            { value: "male", label: "Male" },
          ]}
          error={e.sex}
        />
        <TextField name="birth_date" label="Birth date" type="date" defaultValue={v("birth_date")} error={e.birth_date} />
      </Section>

      <Section title="School">
        <TextField name="college" label="College" maxLength={120} defaultValue={v("college")} error={e.college} />
        <TextField name="program" label="Program" maxLength={120} defaultValue={v("program")} error={e.program} />
        <SelectField name="year_level" label="Year level" defaultValue={v("year_level")} placeholder="Not specified" options={YEAR_OPTIONS} error={e.year_level} />
      </Section>

      <Section title="Contact">
        <TextField name="contact_number" label="Mobile number" type="tel" inputMode="tel" placeholder="09XXXXXXXXX" defaultValue={v("contact_number")} error={e.contact_number} />
        <TextField name="email" label="Email" type="email" defaultValue={v("email")} error={e.email} />
        <TextAreaField name="address" label="Address" rows={2} maxLength={300} className="sm:col-span-2" defaultValue={v("address")} error={e.address} />
      </Section>

      <Section title="Parent or guardian">
        <TextField name="guardian_name" label="Name" maxLength={120} defaultValue={v("guardian_name")} error={e.guardian_name} />
        <TextField name="guardian_relationship" label="Relationship" maxLength={60} defaultValue={v("guardian_relationship")} error={e.guardian_relationship} />
        <TextField name="guardian_contact" label="Mobile number" type="tel" inputMode="tel" placeholder="09XXXXXXXXX" defaultValue={v("guardian_contact")} error={e.guardian_contact} />
      </Section>

      <FormActions cancelHref={cancelHref} submitLabel={student ? "Save changes" : "Add student"} />
    </form>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
      <legend className="px-1 text-sm font-medium">{title}</legend>
      {children}
    </fieldset>
  );
}

export function FormActions({ cancelHref, submitLabel }: { cancelHref: string; submitLabel: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      <SubmitButton>{submitLabel}</SubmitButton>
      <Button variant="ghost" asChild>
        <Link href={cancelHref}>Cancel</Link>
      </Button>
    </div>
  );
}
