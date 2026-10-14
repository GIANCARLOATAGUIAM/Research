import "server-only";

import { addDays, formatTime, formatWeekdays, manilaToday } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export async function getClinicSettings() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("clinic_settings")
    .select("open_days, open_time, close_time, max_days_ahead")
    .eq("id", 1)
    .maybeSingle();
  return data;
}

// Browser-side limits for the request form, from clinic_settings.
export function requestLimits(s: NonNullable<Awaited<ReturnType<typeof getClinicSettings>>>) {
  const today = manilaToday();
  return {
    minDate: today,
    maxDate: addDays(today, s.max_days_ahead),
    openTime: s.open_time.slice(0, 5),
    closeTime: s.close_time.slice(0, 5),
    hoursText: `Open ${formatWeekdays(s.open_days)}, ${formatTime(s.open_time)}–${formatTime(s.close_time)}, up to ${s.max_days_ahead} days ahead.`,
  };
}
