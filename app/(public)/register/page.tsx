import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Brand } from "@/components/app/brand";
import { Disclaimer } from "@/components/app/disclaimer";
import { getAuthState } from "@/lib/auth/dal";
import { ROLE_HOME } from "@/lib/auth/roles";
import { studentRegistrationEnabled } from "@/lib/features";

import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Create student account" };

// SYSTEM_SPEC §8.10. Students only; staff and administrator accounts are
// created by the administrator.
export default async function RegisterPage() {
  if (!studentRegistrationEnabled()) notFound();
  const state = await getAuthState();
  if (state.status === "ok") redirect(ROLE_HOME[state.user.role]);

  return (
    <main className="flex min-h-dvh flex-col px-4 py-8 sm:px-8">
      <Brand />
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-7 py-10">
        <div className="grid gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Create student account</h1>
          <p className="text-sm text-muted-foreground">
            For enrolled students. After you register, the clinic checks your student record before you can request
            appointments.
          </p>
        </div>
        <RegisterForm />
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
      <Disclaimer className="mx-auto w-full max-w-sm" />
    </main>
  );
}
