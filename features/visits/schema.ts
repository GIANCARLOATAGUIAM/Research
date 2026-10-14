import { z } from "zod";

import { localDateTime, optionalText, optionalUuid, requiredText, uuid } from "@/lib/forms";

// SYSTEM_SPEC §4.4 and DFD 3.1-3.4.
export const visitFieldsSchema = z.object({
  visit_at: localDateTime("visit date and time"),
  reason: requiredText("Reason for visit", 2000),
  symptoms: optionalText(2000),
  concern_category_id: uuid("health concern"),
  assessment: optionalText(2000),
  treatment: optionalText(2000),
  follow_up_instructions: optionalText(2000),
});

export const newVisitSchema = visitFieldsSchema.extend({
  student_id: uuid("student"),
  appointment_id: optionalUuid,
});

export type MedicationItem = { medicine_id: string; quantity: number };

// Medication rows arrive as repeated medicine_id / quantity fields.
// Rows with no medicine selected are ignored.
export function parseMedicationRows(formData: FormData):
  | { items: MedicationItem[]; error?: undefined }
  | { items?: undefined; error: string } {
  const ids = formData.getAll("medicine_id").map(String);
  const qtys = formData.getAll("quantity").map(String);
  const items: MedicationItem[] = [];
  for (let i = 0; i < ids.length; i++) {
    if (!ids[i]) continue;
    const quantity = Number(qtys[i]);
    if (!z.uuid().safeParse(ids[i]).success) return { error: "Choose a medicine from the list." };
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) {
      return { error: "Each medicine needs a whole-number quantity of 1 or more." };
    }
    items.push({ medicine_id: ids[i], quantity });
  }
  return { items };
}
