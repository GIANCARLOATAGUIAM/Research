import type { Metadata } from "next";

import { PageHeader } from "@/components/app/page-header";
import { ClinicHoursForm } from "@/features/settings/clinic-hours-form";
import { requireRole } from "@/lib/auth/dal";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Clinic hours" };

export default async function ClinicHoursPage() {
  await requireRole("clinic_staff");
  const supabase = await createClient();
  const { data: settings } = await supabase
    .from("clinic_settings")
    .select("open_days, open_time, close_time, max_days_ahead, updated_at, updater:profiles!clinic_settings_updated_by_fkey(full_name)")
    .eq("id", 1)
    .maybeSingle();

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Clinic hours"
        description="Students can request appointments only on open days, within these hours, and up to the set number of days ahead."
      />
      {settings ? (
        <>
          <ClinicHoursForm settings={settings} />
          <p className="text-xs text-muted-foreground">
            {settings.updater ? `Last changed by ${settings.updater.full_name}, ${formatDateTime(settings.updated_at)}` : "Default hours (not changed yet)."}
          </p>
        </>
      ) : (
        <p className="text-sm text-destructive">Clinic settings are missing. Contact the administrator.</p>
      )}
    </div>
  );
}
