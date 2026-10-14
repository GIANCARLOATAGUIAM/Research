"use client";

import Link from "next/link";
import { useEffect } from "react";
import { CircleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

// Shared loading skeleton and error panel for route-level loading.tsx and
// error.tsx files.

export function PageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="grid gap-5" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="grid gap-2 border-b pb-5">
        <div className="h-6 w-48 animate-pulse motion-reduce:animate-none rounded bg-muted" />
        <div className="h-4 w-72 max-w-full animate-pulse motion-reduce:animate-none rounded bg-muted" />
      </div>
      <div className="h-8 w-full animate-pulse motion-reduce:animate-none rounded-lg bg-muted" />
      <div className="grid gap-2 rounded-lg border bg-card p-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="h-5 animate-pulse motion-reduce:animate-none rounded bg-muted" />
        ))}
      </div>
    </div>
  );
}

export function PageError({ error, reset, homeHref }: { error: Error & { digest?: string }; reset: () => void; homeHref: string }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="grid max-w-lg gap-3 rounded-lg border border-destructive/30 bg-card p-5">
      <p className="flex items-center gap-2 font-medium">
        <CircleAlert className="size-4 text-destructive" aria-hidden="true" />
        Something went wrong while loading this page.
      </p>
      <p className="text-sm text-muted-foreground">
        Your saved records are not affected. Try again, and if it keeps happening, note the reference below for the
        administrator.
      </p>
      {error.digest ? <p className="font-mono text-xs text-muted-foreground">Reference: {error.digest}</p> : null}
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="ghost" asChild>
          <Link href={homeHref}>Go to home page</Link>
        </Button>
      </div>
    </div>
  );
}
