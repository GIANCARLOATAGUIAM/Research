import { cn } from "@/lib/utils";

// Required by SYSTEM_SPEC §2.4 (Paper §3.F, §7).
export function Disclaimer({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs leading-relaxed text-muted-foreground", className)}>
      WUPCare is a records and clinic management tool. It does not diagnose,
      prescribe, or replace professional medical judgment or emergency
      services.
    </p>
  );
}
