"use client";

import { PageError } from "@/components/app/page-states";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <PageError error={error} reset={reset} homeHref="/portal" />;
}
