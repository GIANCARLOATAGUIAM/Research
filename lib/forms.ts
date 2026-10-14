import { z } from "zod";

// Result returned by every form Server Action (PLAN.md ground rules).
// `values` echoes the submitted fields so the form can re-render them after
// React resets it.
export type FormState = {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

export const initialFormState: FormState = {};

export function formValues(formData: FormData) {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && !key.startsWith("$")) values[key] = value;
  }
  return values;
}

export function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

// Validates FormData with a zod schema. On failure returns the FormState to
// send back; on success returns the parsed data.
export function parseForm<T extends z.ZodType>(
  schema: T,
  formData: FormData
): { data: z.infer<T>; state?: undefined } | { data?: undefined; state: FormState } {
  const values = formValues(formData);
  const result = schema.safeParse(values);
  if (!result.success) {
    return {
      state: {
        error: "Please correct the highlighted fields.",
        fieldErrors: fieldErrors(result.error),
        values,
      },
    };
  }
  return { data: result.data };
}

// Common field types --------------------------------------------------------

export const requiredText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, { error: `${label} is required.` })
    .max(max, { error: `${label} must be ${max} characters or fewer.` });

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `Must be ${max} characters or fewer.` })
    .optional()
    .transform((v) => (v ? v : null));

export const uuid = (label: string) =>
  z.uuid({ error: `Choose a ${label}.` });

export const optionalUuid = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .pipe(z.uuid().nullable());

export const isoDate = (label: string) =>
  z.iso.date({ error: `Enter a valid ${label}.` });

export const localDateTime = (label: string) =>
  z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, { error: `Enter a valid ${label}.` });

export const positiveInt = (label: string) =>
  z.coerce
    .number({ error: `${label} must be a number.` })
    .int({ error: `${label} must be a whole number.` })
    .min(1, { error: `${label} must be 1 or more.` })
    .max(100000, { error: `${label} is too large.` });

// PH mobile: 09XXXXXXXXX or +639XXXXXXXXX (SYSTEM_SPEC §7). Optional.
export const phMobile = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v.replace(/[\s-]/g, "") : null))
  .refine((v) => v === null || /^(09\d{9}|\+639\d{9})$/.test(v), {
    error: "Use 09XXXXXXXXX or +639XXXXXXXXX.",
  });

// Search text from the URL. Wildcards are removed so the text matches
// literally; length is capped.
export function searchTerm(q: string | undefined) {
  return (q ?? "").replace(/[%*\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

// PostgREST or() filter: any of the columns contains the term. The value is
// double-quoted, so commas, dots, parentheses, and apostrophes in names
// (for example "O'Brien" or "Ma. Cristina") are matched literally.
export function ilikeAny(columns: string[], term: string) {
  const value = term.replace(/"/g, '\\"');
  return columns.map((c) => `${c}.ilike."%${value}%"`).join(",");
}
