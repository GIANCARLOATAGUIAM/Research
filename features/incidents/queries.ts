import "server-only";

import { cache } from "react";

import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const getIncident = cache(async (id: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("health_incidents")
    .select(
      "*, students(id, student_number, first_name, middle_name, last_name, is_demo), recorder:profiles!health_incidents_recorded_by_fkey(full_name), updater:profiles!health_incidents_updated_by_fkey(full_name)"
    )
    .eq("id", id)
    .maybeSingle();
  return data;
});

// Recent visits of a student, for the optional "related visit" link.
export async function visitOptions(studentId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clinic_visits")
    .select("id, visit_at, reason")
    .eq("student_id", studentId)
    .order("visit_at", { ascending: false })
    .limit(20);
  return (data ?? []).map((v) => ({ id: v.id, label: `${formatDateTime(v.visit_at)} · ${v.reason.slice(0, 40)}` }));
}
