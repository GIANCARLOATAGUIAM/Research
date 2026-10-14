"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogOut, Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { logout } from "@/features/auth/actions";
import { ROLE_LABELS, type Role } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

import { Brand } from "./brand";
import { navForRole } from "./nav";

type ShellUser = { fullName: string; email: string; role: Role };
type ShellCounts = { pendingAppointments?: number; pendingRegistrations?: number };

export function ClinicShell({
  user,
  counts = {},
  registration = false,
  children,
}: {
  user: ShellUser;
  counts?: ShellCounts;
  registration?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-background px-3 py-2 text-sm font-medium shadow focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to main content
      </a>
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 border-r bg-sidebar text-sidebar-foreground md:flex md:flex-col print:hidden">
        <SidebarContents user={user} counts={counts} registration={registration} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur-sm md:hidden print:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open navigation">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-64 gap-0 bg-sidebar p-0 text-sidebar-foreground"
            >
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SheetDescription className="sr-only">
                WUPCare main menu
              </SheetDescription>
              <SidebarContents user={user} counts={counts} registration={registration} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <Brand />
        </header>

        {children}
      </div>
    </div>
  );
}

function SidebarContents({
  user,
  counts,
  registration,
  onNavigate,
}: {
  user: ShellUser;
  counts: ShellCounts;
  registration: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const items = navForRole(user.role, registration);

  return (
    <>
      <div className="flex h-16 items-center px-4">
        <Brand />
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 py-2">
        <ul className="grid gap-0.5">
          {items.map((item) => {
            const Icon = item.icon;
            // A more specific item (Students > Registrations) takes the highlight.
            const active =
              pathname === item.href ||
              (pathname.startsWith(`${item.href}/`) &&
                !items.some((o) => o.href !== item.href && o.href.startsWith(`${item.href}/`) && pathname.startsWith(o.href)));

            const count = item.countKey ? counts[item.countKey] : undefined;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors duration-150",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sidebar-ring",
                    active &&
                      "bg-sidebar-accent font-medium text-sidebar-accent-foreground forced-colors:underline forced-colors:outline forced-colors:outline-1 forced-colors:outline-[Highlight]"
                  )}
                >
                  <Icon
                    className={cn("size-4", active && "text-sidebar-primary")}
                  />
                  {item.label}
                  {count ? (
                    <span className="ml-auto rounded-full bg-warning/30 px-1.5 text-[11px] font-medium tabular text-warning-foreground">
                      <span className="sr-only">, </span>
                      {count}
                      <span className="sr-only"> waiting</span>
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="px-2.5 pb-2.5">
          <p className="truncate text-sm font-medium">{user.fullName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {ROLE_LABELS[user.role]}
          </p>
        </div>
        <form action={logout}>
          <Button
            type="submit"
            variant="ghost"
            className="w-full justify-start gap-2.5 px-2.5 text-sidebar-foreground"
          >
            <LogOut className="size-4" />
            Sign out
          </Button>
        </form>
      </div>
    </>
  );
}
