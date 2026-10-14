import Link from "next/link";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { cn } from "@/lib/utils";

export const PAGE_SIZE = 25;

export type Scope = "all" | "real" | "demo";

export type SearchParams = Record<string, string | string[] | undefined>;

export function param(sp: SearchParams, key: string) {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

export function pageParam(sp: SearchParams) {
  const n = Number(param(sp, "page"));
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export function scopeParam(sp: SearchParams, fallback: Scope = "all"): Scope {
  const v = param(sp, "scope");
  return v === "real" || v === "demo" || v === "all" ? v : fallback;
}

export function dateParam(sp: SearchParams, key: string) {
  const v = param(sp, key);
  return v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
}

// Builds a URL that keeps the current filters and changes some of them.
export function hrefWith(path: string, sp: SearchParams, changes: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const value = Array.isArray(v) ? v[0] : v;
    if (value) params.set(k, value);
  }
  for (const [k, v] of Object.entries(changes)) {
    if (v) params.set(k, v);
    else params.delete(k);
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

// GET form for list filters. Works without client JavaScript.
export function FilterBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <form method="get" className={cn("flex flex-wrap items-end gap-3", className)} role="search">
      {children}
      <Button type="submit" variant="outline">
        Apply
      </Button>
    </form>
  );
}

export function SearchInput({ defaultValue, placeholder, label = "Search" }: { defaultValue?: string; placeholder: string; label?: string }) {
  return (
    <div className="grid min-w-52 flex-1 gap-1.5">
      <Label htmlFor="q" className="text-xs text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input id="q" name="q" type="search" defaultValue={defaultValue} placeholder={placeholder} className="pl-8" />
      </div>
    </div>
  );
}

export function FilterSelect({
  name,
  label,
  defaultValue,
  options,
  className,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <div className={cn("grid w-[calc(50%-0.375rem)] gap-1.5 sm:w-40", className)}>
      <Label htmlFor={`f-${name}`} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <NativeSelect id={`f-${name}`} name={name} defaultValue={defaultValue ?? ""}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

export function FilterText({ name, label, defaultValue, className }: { name: string; label: string; defaultValue?: string; className?: string }) {
  return (
    <div className={cn("grid w-[calc(50%-0.375rem)] gap-1.5 sm:w-44", className)}>
      <Label htmlFor={`f-${name}`} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input id={`f-${name}`} name={name} defaultValue={defaultValue} />
    </div>
  );
}

export function FilterDate({ name, label, defaultValue }: { name: string; label: string; defaultValue?: string }) {
  return (
    <div className="grid w-[calc(50%-0.375rem)] gap-1.5 sm:w-40">
      <Label htmlFor={`f-${name}`} className="text-xs text-muted-foreground">
        {label}
      </Label>
      <Input id={`f-${name}`} name={name} type="date" defaultValue={defaultValue} />
    </div>
  );
}

export const SCOPE_OPTIONS = [
  { value: "all", label: "All records" },
  { value: "real", label: "Real only" },
  { value: "demo", label: "Demo only" },
];

export function Pagination({
  path,
  sp,
  page,
  total,
}: {
  path: string;
  sp: SearchParams;
  page: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  if (total === 0) return null;
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
      <p className="tabular">
        {from}–{to} of {total}
      </p>
      <div className="flex gap-1">
        <PageLink href={hrefWith(path, sp, { page: String(page - 1) })} disabled={page <= 1} label="Previous page">
          <ChevronLeft />
        </PageLink>
        <PageLink href={hrefWith(path, sp, { page: String(page + 1) })} disabled={page >= pages} label="Next page">
          <ChevronRight />
        </PageLink>
      </div>
    </nav>
  );
}

function PageLink({ href, disabled, label, children }: { href: string; disabled: boolean; label: string; children: React.ReactNode }) {
  if (disabled) {
    return (
      <Button variant="outline" size="icon" disabled aria-label={label}>
        {children}
      </Button>
    );
  }
  return (
    <Button variant="outline" size="icon" asChild>
      <Link href={href} aria-label={label}>
        {children}
      </Link>
    </Button>
  );
}

// Link-based tabs. Server-rendered, so each tab is a shareable URL.
export function LinkTabs({
  tabs,
  active,
  label,
}: {
  tabs: { key: string; label: string; href: string; count?: number }[];
  active: string;
  label: string;
}) {
  return (
    <nav aria-label={label} className="-mb-px flex gap-1 overflow-x-auto border-b">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={t.key === active ? "page" : undefined}
          className={cn(
            "flex h-9 items-center gap-1.5 border-b-2 border-transparent px-2.5 text-sm sm:px-3 whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
            // Forced colors paints transparent borders; keep only the current tab underlined.
            "forced-colors:[border-bottom-color:Canvas]",
            t.key === active && "border-primary font-medium text-foreground forced-colors:[border-bottom-color:Highlight]"
          )}
        >
          {t.label}
          {t.count !== undefined ? <span className="tabular text-xs text-muted-foreground">{t.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

export function TableEmpty({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-8 text-center text-sm text-muted-foreground">
        {children}
      </td>
    </tr>
  );
}
