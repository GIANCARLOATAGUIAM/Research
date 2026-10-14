import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { DemoBadge, StockFlags, stockState } from "@/components/app/badges";
import {
  FilterBar,
  FilterSelect,
  PAGE_SIZE,
  Pagination,
  SCOPE_OPTIONS,
  SearchInput,
  TableEmpty,
  pageParam,
  param,
  scopeParam,
} from "@/components/app/list-controls";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { expirySoonDate } from "@/features/medications/queries";
import { requireRole } from "@/lib/auth/dal";
import { searchTerm } from "@/lib/forms";
import { formatDate, manilaToday } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Medications" };

const FLAG_OPTIONS = [
  { value: "", label: "Any stock" },
  { value: "low", label: "Low stock" },
  { value: "expiring", label: "Expiring in 30 days" },
  { value: "expired", label: "Expired" },
];
const ACTIVE_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "any", label: "Active and inactive" },
];

export default async function MedicationsPage({ searchParams }: PageProps<"/medications">) {
  await requireRole("clinic_staff");
  const sp = await searchParams;
  const q = searchTerm(param(sp, "q"));
  const flag = param(sp, "flag");
  const active = param(sp, "active") ?? "active";
  const scope = scopeParam(sp);
  const page = pageParam(sp);
  const today = manilaToday();
  const soon = expirySoonDate();

  // The inventory is small (tens of rows), so flags that compare two columns
  // (stock vs reorder level) are filtered here rather than in SQL.
  const supabase = await createClient();
  let query = supabase.from("medicines").select("*").order("name").order("expiration_date").limit(1000);
  if (q) query = query.ilike("name", `%${q}%`);
  if (active === "active") query = query.eq("is_active", true);
  if (active === "inactive") query = query.eq("is_active", false);
  if (scope !== "all") query = query.eq("is_demo", scope === "demo");
  const { data, error } = await query;

  const rows = (data ?? [])
    .map((m) => ({ ...m, state: stockState(m, today, soon) }))
    .filter((m) =>
      flag === "low" ? m.state.low : flag === "expiring" ? m.state.expiringSoon : flag === "expired" ? m.state.expired : true
    );
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Medications"
        description="Medicine inventory, stock levels, and expiration."
        actions={
          <Button asChild>
            <Link href="/medications/new">
              <Plus />
              Add medicine
            </Link>
          </Button>
        }
      />

      <FilterBar>
        <SearchInput defaultValue={param(sp, "q")} placeholder="Medicine name" />
        <FilterSelect name="flag" label="Stock" defaultValue={flag} options={FLAG_OPTIONS} className="sm:w-48" />
        <FilterSelect name="active" label="Status" defaultValue={active} options={ACTIVE_OPTIONS} className="sm:w-48" />
        <FilterSelect name="scope" label="Records" defaultValue={scope} options={SCOPE_OPTIONS} className="sm:w-36" />
      </FilterBar>

      {error ? (
        <p className="text-sm text-destructive">Could not load medicines. Please reload the page.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Medicine</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="hidden text-right sm:table-cell">Reorder at</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="hidden md:table-cell">Flags</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.length ? (
              pageRows.map((m) => (
                <TableRow key={m.id} className={cn(!m.is_active && "text-muted-foreground")}>
                  <TableCell>
                    <span className="inline-flex flex-wrap items-center gap-1.5">
                      <Link href={`/medications/${m.id}`} className="font-medium hover:underline">
                        {m.name}
                      </Link>
                      {m.is_demo ? <DemoBadge /> : null}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular whitespace-nowrap">
                    {m.stock_quantity} <span className="text-muted-foreground">{m.unit}</span>
                  </TableCell>
                  <TableCell className="hidden text-right tabular sm:table-cell">{m.reorder_level}</TableCell>
                  <TableCell className={cn("whitespace-nowrap", m.state.expired && "text-destructive")}>{formatDate(m.expiration_date)}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <StockFlags state={m.state} inactive={!m.is_active} />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableEmpty colSpan={5}>No medicines found.</TableEmpty>
            )}
          </TableBody>
        </Table>
      )}

      <Pagination path="/medications" sp={sp} page={page} total={rows.length} />
    </div>
  );
}
