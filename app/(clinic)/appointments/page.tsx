import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarPlus } from "lucide-react";

import { AppointmentStatusBadge, DemoBadge } from "@/components/app/badges";
import {
  FilterBar,
  FilterDate,
  FilterSelect,
  LinkTabs,
  PAGE_SIZE,
  Pagination,
  SCOPE_OPTIONS,
  SearchInput,
  TableEmpty,
  dateParam,
  hrefWith,
  pageParam,
  param,
  scopeParam,
} from "@/components/app/list-controls";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/dal";
import { ilikeAny, searchTerm } from "@/lib/forms";
import { addDays, formatDate, formatDateTime, formatTime, manilaDayStart, manilaToday, studentName } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Appointments" };

const VIEWS = ["pending", "today", "approved", "completed", "declined", "cancelled", "all"] as const;
type View = (typeof VIEWS)[number];
const VIEW_LABELS: Record<View, string> = {
  pending: "Pending",
  today: "Today",
  approved: "Upcoming",
  completed: "Completed",
  declined: "Declined",
  cancelled: "Cancelled",
  all: "All",
};

export default async function AppointmentsPage({ searchParams }: PageProps<"/appointments">) {
  await requireRole("clinic_staff");
  const sp = await searchParams;
  const viewParam = param(sp, "view");
  const view: View = VIEWS.includes(viewParam as View) ? (viewParam as View) : "pending";
  const q = searchTerm(param(sp, "q"));
  const date = dateParam(sp, "date");
  const scope = scopeParam(sp);
  const page = pageParam(sp);
  const today = manilaToday();

  const supabase = await createClient();
  let query = supabase
    .from("appointments")
    .select(
      "id, preferred_date, preferred_time, scheduled_at, status, reason, created_at, students!inner(id, student_number, first_name, middle_name, last_name, is_demo)",
      { count: "exact" }
    )
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (view === "pending") query = query.eq("status", "pending").order("preferred_date").order("preferred_time");
  else if (view === "today")
    query = query
      .eq("status", "approved")
      .gte("scheduled_at", manilaDayStart(today))
      .lt("scheduled_at", manilaDayStart(addDays(today, 1)))
      .order("scheduled_at");
  else if (view === "approved") query = query.eq("status", "approved").order("scheduled_at");
  else if (view === "all") query = query.order("created_at", { ascending: false });
  else query = query.eq("status", view).order("updated_at", { ascending: false });

  if (date) {
    query = query.or(
      `preferred_date.eq.${date},and(scheduled_at.gte."${manilaDayStart(date)}",scheduled_at.lt."${manilaDayStart(addDays(date, 1))}")`
    );
  }
  if (scope !== "all") query = query.eq("students.is_demo", scope === "demo");
  if (q) {
    query = query.or(ilikeAny(["student_number", "first_name", "last_name"], q), { referencedTable: "students" });
  }

  const { data: rows, count, error } = await query;
  // A page number past the end: go back to the first page.
  if (error?.code === "PGRST103") redirect(hrefWith("/appointments", sp, { page: undefined }));

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Appointments"
        description="Review requests, confirm schedules, and track attendance."
        actions={
          <Button asChild>
            <Link href="/appointments/new">
              <CalendarPlus />
              Book appointment
            </Link>
          </Button>
        }
      />

      <LinkTabs
        label="Appointment views"
        active={view}
        tabs={VIEWS.map((v) => ({ key: v, label: VIEW_LABELS[v], href: hrefWith("/appointments", sp, { view: v, page: undefined }) }))}
      />

      <FilterBar>
        <input type="hidden" name="view" value={view} />
        <SearchInput defaultValue={param(sp, "q")} placeholder="Student number or name" label="Student" />
        <FilterDate name="date" label="Date" defaultValue={date} />
        <FilterSelect name="scope" label="Records" defaultValue={scope} options={SCOPE_OPTIONS} className="sm:w-36" />
      </FilterBar>

      {error ? (
        <p className="text-sm text-destructive">Could not load appointments. Please reload the page.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Requested for</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Student</TableHead>
              <TableHead className="hidden md:table-cell">Reason</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows?.length ? (
              rows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="whitespace-nowrap">
                    <Link href={`/appointments/${a.id}`} className="font-medium hover:underline">
                      {formatDate(a.preferred_date)}, {formatTime(a.preferred_time)}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{a.scheduled_at ? formatDateTime(a.scheduled_at) : "—"}</TableCell>
                  <TableCell>
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      {studentName(a.students)}
                      {a.students.is_demo ? <DemoBadge /> : null}
                    </span>
                  </TableCell>
                  <TableCell className="hidden max-w-64 truncate md:table-cell">{a.reason}</TableCell>
                  <TableCell>
                    <AppointmentStatusBadge status={a.status} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableEmpty colSpan={5}>No appointments in this view.</TableEmpty>
            )}
          </TableBody>
        </Table>
      )}

      <Pagination path="/appointments" sp={sp} page={page} total={count ?? 0} />
    </div>
  );
}
