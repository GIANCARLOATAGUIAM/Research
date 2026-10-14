import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CircleAlert, Settings2 } from "lucide-react";

import { Brand } from "@/components/app/brand";
import { Disclaimer } from "@/components/app/disclaimer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { logout } from "@/features/auth/actions";
import { getAuthState, type AccountProblem } from "@/lib/auth/dal";
import { ROLE_HOME } from "@/lib/auth/roles";
import { studentRegistrationEnabled } from "@/lib/features";
import { isSupabaseConfigured } from "@/lib/supabase/env";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const PROBLEM_COPY: Record<AccountProblem, { title: string; body: string }> = {
  no_profile: {
    title: "Your account is not set up yet",
    body: "You are signed in, but this account has no WUPCare role assigned. Ask the clinic administrator to finish setting up your account.",
  },
  inactive: {
    title: "This account is deactivated",
    body: "Ask the clinic administrator to reactivate it if you still need access.",
  },
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const confirmFailed = sp.error === "confirm";
  const registration = studentRegistrationEnabled();
  const state = await getAuthState();
  if (state.status === "ok") redirect(ROLE_HOME[state.user.role]);

  const configured = isSupabaseConfigured();

  return (
    <div className="grid min-h-dvh grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <aside className="hidden flex-col justify-between border-r bg-sidebar p-10 lg:flex">
        <Brand />
        <div className="grid gap-3">
          <p className="text-lg font-medium leading-snug tracking-tight text-balance">
            Student health records, clinic visits, appointments, and medicine
            inventory in one place.
          </p>
          <p className="text-sm text-muted-foreground">
            For authorized clinic personnel, administrators, and students of
            Wesleyan University-Philippines.
          </p>
        </div>
        <Disclaimer className="max-w-sm" />
      </aside>

      <main className="flex flex-col px-4 py-8 sm:px-8">
        <Brand className="lg:hidden" />

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-7 py-10">
          {state.status === "blocked" ? (
            <BlockedAccount problem={state.problem} email={state.email} />
          ) : (
            <>
              <div className="grid gap-1.5">
                <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
                <p className="text-sm text-muted-foreground">
                  Use your WUPCare email and password.
                </p>
              </div>

              {!configured ? (
                <Alert>
                  <Settings2 />
                  <AlertTitle>Supabase is not configured</AlertTitle>
                  <AlertDescription>
                    Copy <code className="font-mono text-xs">.env.example</code>{" "}
                    to <code className="font-mono text-xs">.env.local</code> and
                    add the project URL and publishable key, then restart the
                    dev server.
                  </AlertDescription>
                </Alert>
              ) : null}

              {confirmFailed ? (
                <Alert variant="destructive">
                  <CircleAlert />
                  <AlertDescription>
                    The confirmation link is invalid or has expired. Sign in if you already confirmed, or register again.
                  </AlertDescription>
                </Alert>
              ) : null}

              <LoginForm disabled={!configured} />

              {registration ? (
                <p className="text-sm text-muted-foreground">
                  Student without an account?{" "}
                  <Link href="/register" className="text-primary hover:underline">
                    Create a student account
                  </Link>
                  <span className="mt-1 block text-xs">Clinic personnel accounts are created by the administrator.</span>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  There is no public sign-up. Accounts are created by the clinic
                  administrator.
                </p>
              )}
            </>
          )}
        </div>

        <Disclaimer className="mx-auto w-full max-w-sm lg:hidden" />
      </main>
    </div>
  );
}

function BlockedAccount({
  problem,
  email,
}: {
  problem: AccountProblem;
  email: string;
}) {
  const copy = PROBLEM_COPY[problem];

  return (
    <div className="grid gap-5">
      <Alert>
        <CircleAlert />
        <AlertTitle>{copy.title}</AlertTitle>
        <AlertDescription>{copy.body}</AlertDescription>
      </Alert>
      {email ? (
        <p className="text-sm text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{email}</span>
        </p>
      ) : null}
      <form action={logout}>
        <Button type="submit" variant="outline" size="lg" className="w-full">
          Sign out
        </Button>
      </form>
    </div>
  );
}
