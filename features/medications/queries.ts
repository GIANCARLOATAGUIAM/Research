import "server-only";

import { addDays, manilaToday } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export type IssuableMedicine = { id: string; name: string; unit: string; stock_quantity: number; expiration_date: string };

// Medicines that can be issued to a student right now: active, not expired,
// in stock, and on the same side of the demo/real line as the student
// (the database enforces the same rules in issue_items).
export async function issuableMedicines(isDemo: boolean): Promise<IssuableMedicine[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("medicines")
    .select("id, name, unit, stock_quantity, expiration_date")
    .eq("is_active", true)
    .eq("is_demo", isDemo)
    .gt("stock_quantity", 0)
    .gte("expiration_date", manilaToday())
    .order("name");
  return data ?? [];
}

export function expirySoonDate() {
  return addDays(manilaToday(), 30);
}

export async function concernCategories() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("health_concern_categories")
    .select("id, name, is_active")
    .order("sort_order");
  return data ?? [];
}
