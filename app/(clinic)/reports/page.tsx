import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";

import {
  FilterBar,
  FilterDate,
  FilterSelect,
  LinkTabs,
  TableEmpty,
  dateParam,
  hrefWith,
  param,
  scopeParam,
} from "@/components/app/list-controls";
import { PageHeader } from "@/components/app/page-header";
import { PrintButton } from "@/components/app/print-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/dal";
import { formatDate, formatDateTime, manilaToday, monthStart } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Reports" };

const REPORTS = {
  visits: "Clinic visits",
  concerns: "Common health concerns",
  medications: "Medication usage",
  incidents: "Health incidents",
  appointments: "Appointments",
} as const;
type ReportKey = keyof typeof REPORTS;

const SCOPE_LABEL = { real: "Real records only", demo: "Demo records only", all: "All records" } as const;

type Row = { label: string; count: number | null; extra?: string };

// FR-RPT-1..4. Aggregate counts only, from the report_* database functions.
// For administrators the database widens the range to whole months and hides
// counts below 5 (FR-RPT-3a); null counts are shown as "<5".
export default async function ReportsPage({ searchParams }: PageProps<"/reports">) {
  const user = await requireRole("admin", "clinic_staff");
  const isAdmin = user.role === "admin";
  const sp = await searchParams;
  const reportParam = param(sp, "report");
  const report: ReportKey = reportParam && reportParam in REPORTS ? (reportParam as ReportKey) : "visits";
  const today = manilaToday();
  let from = dateParam(sp, "from") ?? monthStart(today);
  let to = dateParam(sp, "to") ?? today;
  if (to < from) [from, to] = [to, from];
  const scope = scopeParam(sp, "real");
  const period = isAdmin ? "month" : param(sp, "period") === "month" ? "month" : "day";

  const supabase = await createClient();
  const args = { p_from: from, p_to: to, p_scope: scope };
  let rows: Row[] = [];
  let header: [string, string, string?] = ["", "Count"];
  let failed = false;

  if (report === "visits") {
    const { data, error } = await supabase.rpc("report_visits", { ...args, p_period: period });
    failed = Boolean(error);
    header = [period === "month" ? "Month" : "Date", "Visits"];
    rows = (data ?? []).map((r) => ({
      label: period === "month" ? new Date(`${r.period}T00:00:00+08:00`).toLocaleDateString("en-PH", { month: "long", year: "numeric", timeZone: "Asia/Manila" }) : formatDate(r.period),
      count: r.visit_count,
    }));
  } else if (report === "concerns") {
    const { data, error } = await supabase.rpc("report_concerns", args);
    failed = Boolean(error);
    header = ["Health concern", "Visits"];
    rows = (data ?? []).map((r) => ({ label: r.category, count: r.visit_count }));
  } else if (report === "medications") {
    const { data, error } = await supabase.rpc("report_medication_usage", args);
    failed = Boolean(error);
    header = ["Medicine", "Quantity issued", "Current stock"];
    rows = (data ?? []).map((r) => ({ label: r.medicine_name, count: r.quantity_issued, extra: `${r.stock_quantity} ${r.unit}` }));
  } else if (report === "incidents") {
    const { data, error } = await supabase.rpc("report_incidents", args);
    failed = Boolean(error);
    header = ["Incident type", "Incidents"];
    rows = (data ?? []).map((r) => ({ label: r.incident_type.charAt(0).toUpperCase() + r.incident_type.slice(1), count: r.incident_count }));
  } else {
    const { data, error } = await supabase.rpc("report_appointments", args);
    failed = Boolean(error);
    header = ["Status", "Appointments"];
    rows = (data ?? []).map((r) => ({ label: r.status.charAt(0).toUpperCase() + r.status.slice(1), count: r.appointment_count }));
  }

  const hasHidden = rows.some((r) => r.count === null);
  const total = rows.reduce((sum, r) => sum + (r.count ?? 0), 0);
  const showCount = (n: number | null) => (n === null ? "<5" : n.toLocaleString("en-PH"));
  const rangeLabel = isAdmin
    ? `${formatDate(monthStart(from))} – end of ${new Date(`${to}T00:00:00+08:00`).toLocaleDateString("en-PH", { month: "long", year: "numeric", timeZone: "Asia/Manila" })}`
    : `${formatDate(from)} – ${formatDate(to)}`;

  return (
    <div className="grid gap-5">
      <div className="hidden print:block">
        <p className="text-lg font-semibold">WUPCare · {REPORTS[report]}</p>
        <p className="text-sm">
          {rangeLabel} · {SCOPE_LABEL[scope]}
        </p>
        <p className="text-xs">
          Printed by {user.fullName} on {formatDateTime(new Date())}
        </p>
      </div>

      <div className="print:hidden">
        <PageHeader title="Reports" description="Summary counts for a date range." actions={<PrintButton />} />
      </div>

      <div className="grid gap-4 print:hidden">
        <LinkTabs
          label="Reports"
          active={report}
          tabs={(Object.keys(REPORTS) as ReportKey[]).map((k) => ({ key: k, label: REPORTS[k], href: hrefWith("/reports", sp, { report: k }) }))}
        />
        <FilterBar>
          <input type="hidden" name="report" value={report} />
          <FilterDate name="from" label="From" defaultValue={from} />
          <FilterDate name="to" label="To" defaultValue={to} />
          {report === "visits" && !isAdmin ? (
            <FilterSelect
              name="period"
              label="Group by"
              defaultValue={period}
              options={[
                { value: "day", label: "Day" },
                { value: "month", label: "Month" },
              ]}
              className="sm:w-32"
            />
          ) : null}
          <FilterSelect
            name="scope"
            label="Records"
            defaultValue={scope}
            options={[
              { value: "real", label: "Real only" },
              { value: "demo", label: "Demo only" },
              { value: "all", label: "All records" },
            ]}
            className="sm:w-36"
          />
        </FilterBar>
        {isAdmin ? (
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            Administrator reports cover whole months, and counts below 5 are shown as &lt;5 to protect student privacy.
          </p>
        ) : null}
      </div>

      <section className={report === "medications" ? "grid max-w-3xl gap-2" : "grid max-w-2xl gap-2"}>
        <h2 className="text-sm font-medium">
          {REPORTS[report]} <span className="font-normal text-muted-foreground">· {rangeLabel} · {SCOPE_LABEL[scope]}</span>
        </h2>
        {failed ? (
          <p className="text-sm text-destructive">Could not load the report. Please try again.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{header[0]}</TableHead>
                <TableHead className="text-right">{header[1]}</TableHead>
                {header[2] ? <TableHead className="text-right">{header[2]}</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length ? (
                <>
                  {rows.map((r) => (
                    <TableRow key={r.label}>
                      <TableCell>{r.label}</TableCell>
                      <TableCell className="text-right tabular">{showCount(r.count)}</TableCell>
                      {header[2] ? <TableCell className="text-right tabular text-muted-foreground">{r.extra}</TableCell> : null}
                    </TableRow>
                  ))}
                  {report !== "medications" ? (
                    <TableRow className="bg-muted/40 font-medium">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right tabular">{hasHidden ? `${total.toLocaleString("en-PH")}+` : total.toLocaleString("en-PH")}</TableCell>
                    </TableRow>
                  ) : null}
                </>
              ) : (
                <TableEmpty colSpan={header[2] ? 3 : 2}>No records in this range.</TableEmpty>
              )}
            </TableBody>
          </Table>
        )}
        {hasHidden && report !== "medications" ? (
          <p className="text-xs text-muted-foreground">The total excludes groups shown as &lt;5.</p>
        ) : null}
      </section>
    </div>
  );
}
