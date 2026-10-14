import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export const getVisit = cache(async (id: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("clinic_visits")
    .select(
      "*, students(id, student_number, first_name, middle_name, last_name, is_demo), category:health_concern_categories(name), attended:profiles!clinic_visits_attended_by_fkey(full_name), updater:profiles!clinic_visits_updated_by_fkey(full_name)"
    )
    .eq("id", id)
    .maybeSingle();
  return data;
});
