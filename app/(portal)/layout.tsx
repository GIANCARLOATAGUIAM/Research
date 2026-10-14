import Link from "next/link";
import { LogOut } from "lucide-react";

import { Brand, BrandMark } from "@/components/app/brand";
import { Disclaimer } from "@/components/app/disclaimer";
import { Button } from "@/components/ui/button";
import { logout } from "@/features/auth/actions";
import { requireRole } from "@/lib/auth/dal";

// Minimal shell for students. Every page under this group must still call
// requireRole("student") itself, because layouts do not re-run on navigation.
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireRole("student");

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-background px-3 py-2 text-sm font-medium shadow focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to main content
      </a>
      <header className="border-b bg-sidebar">
        <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/portal" aria-label="WUPCare home">
            <Brand className="hidden sm:flex" />
            <BrandMark className="sm:hidden" />
          </Link>
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden truncate text-sm text-muted-foreground sm:block">
              {user.fullName}
            </span>
            <Link href="/portal/account" className="text-sm text-muted-foreground hover:text-foreground">
              Account
            </Link>
            <form action={logout}>
              <Button type="submit" variant="ghost" size="sm">
                <LogOut />
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        {children}
      </main>

      <footer className="mx-auto w-full max-w-3xl px-4 pb-6 sm:px-6">
        <Disclaimer className="border-t pt-4" />
      </footer>
    </div>
  );
}
