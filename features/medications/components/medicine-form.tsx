"use client";

import { useActionState } from "react";

import { TextField } from "@/components/app/fields";
import { FormAlert } from "@/components/app/form-status";
import { FormActions } from "@/features/students/components/student-form";
import { initialFormState, type FormState } from "@/lib/forms";
import type { Tables } from "@/types/database";

type Action = (prev: FormState, formData: FormData) => Promise<FormState>;

export function MedicineForm({
  action,
  medicine,
  cancelHref,
}: {
  action: Action;
  medicine?: Tables<"medicines">;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);
  const e = state.fieldErrors ?? {};
  const v = (k: string, fallback = "") =>
    state.values?.[k] ?? (medicine && k in medicine ? String(medicine[k as keyof typeof medicine] ?? "") : fallback);

  return (
    <form action={formAction} noValidate className="grid max-w-2xl gap-5">
      <FormAlert state={state} />
      <div className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2">
        <TextField name="name" label="Medicine name" required maxLength={120} placeholder="e.g. Paracetamol 500mg" defaultValue={v("name")} error={e.name} />
        <TextField name="unit" label="Unit" required maxLength={40} placeholder="tablet, capsule, bottle, sachet" defaultValue={v("unit")} error={e.unit} />
        <TextField name="expiration_date" label="Expiration date" type="date" required defaultValue={v("expiration_date")} error={e.expiration_date} />
        <TextField
          name="reorder_level"
          label="Reorder level"
          type="number"
          min={0}
          required
          defaultValue={v("reorder_level", "10")}
          error={e.reorder_level}
          hint="Shown as Low stock at or below this quantity."
        />
        {medicine ? null : (
          <TextField
            name="starting_stock"
            label="Starting stock"
            type="number"
            min={0}
            required
            defaultValue={v("starting_stock", "0")}
            error={e.starting_stock}
            hint="Saved as a restock transaction."
          />
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        Stock with a different expiration date is added as a separate medicine row.
      </p>
      <FormActions cancelHref={cancelHref} submitLabel={medicine ? "Save changes" : "Add medicine"} />
    </form>
  );
}
