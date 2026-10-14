import { Badge } from "@/components/ui/badge";
import type { Database } from "@/types/database";
import { cn } from "@/lib/utils";

type AppointmentStatus = Database["public"]["Enums"]["appointment_status"];

// Fixed status colors (SYSTEM_SPEC §6.3).
const STATUS: Record<AppointmentStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-warning/25 text-warning-foreground" },
  approved: { label: "Approved", className: "bg-info/12 text-info" },
  completed: { label: "Completed", className: "bg-success/12 text-success" },
  declined: { label: "Declined", className: "bg-muted text-muted-foreground" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
};

export function AppointmentStatusBadge({ status }: { status: AppointmentStatus }) {
  const s = STATUS[status];
  return <Badge className={s.className}>{s.label}</Badge>;
}

export function DemoBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={cn("h-4.5 px-1.5 text-[10px] tracking-wider text-muted-foreground", className)}>
      DEMO
    </Badge>
  );
}

export function StudentStatusBadge({ status }: { status: "active" | "inactive" | "graduated" }) {
  if (status === "active") return null;
  return (
    <Badge variant="secondary" className="capitalize">
      {status}
    </Badge>
  );
}

export type StockState = { low: boolean; expired: boolean; expiringSoon: boolean };

export function stockState(
  m: { stock_quantity: number; reorder_level: number; expiration_date: string },
  today: string,
  soon: string
): StockState {
  return {
    low: m.stock_quantity <= m.reorder_level,
    expired: m.expiration_date < today,
    expiringSoon: m.expiration_date >= today && m.expiration_date <= soon,
  };
}

export function StockFlags({ state, inactive }: { state: StockState; inactive?: boolean }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {inactive ? <Badge variant="secondary">Inactive</Badge> : null}
      {state.expired ? <Badge variant="destructive">Expired</Badge> : null}
      {state.expiringSoon ? <Badge className="bg-warning/25 text-warning-foreground">Expiring soon</Badge> : null}
      {state.low ? <Badge className="bg-warning/25 text-warning-foreground">Low stock</Badge> : null}
    </span>
  );
}
