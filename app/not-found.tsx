import Link from "next/link";

import { Brand } from "@/components/app/brand";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    // Not a <main>: notFound() inside the app renders this within the app's own <main>.
    <div className="mx-auto grid min-h-[60dvh] w-full max-w-md content-center gap-4 px-4">
      <Brand />
      <h1 className="text-xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-sm text-muted-foreground">
        The page or record does not exist, or you do not have access to it.
      </p>
      <div>
        <Button asChild>
          <Link href="/">Go to home page</Link>
        </Button>
      </div>
    </div>
  );
}
