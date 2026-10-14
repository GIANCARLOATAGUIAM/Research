import { cn } from "@/lib/utils";

// WUPCare mark: a cross inside a rounded square, drawn as one SVG.
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("size-7 shrink-0", className)}
    >
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path
        d="M13.5 8h5v5.5H24v5h-5.5V24h-5v-5.5H8v-5h5.5z"
        className="fill-primary-foreground"
      />
    </svg>
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <BrandMark />
      <div className="leading-tight">
        <p className="text-[15px] font-semibold tracking-tight">WUPCare</p>
        <p className="text-xs text-muted-foreground">
          Wesleyan University-Philippines
        </p>
      </div>
    </div>
  );
}
