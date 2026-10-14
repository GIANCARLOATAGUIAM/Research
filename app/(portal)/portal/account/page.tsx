import type { Metadata } from "next";

import { DetailItem } from "@/components/app/fields";
import { PageHeader } from "@/components/app/page-header";
import { PasswordForm } from "@/features/account/password-form";
import { requireRole } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Account" };

export default async function PortalAccountPage() {
  const user = await requireRole("student");
  return (
    <div className="grid gap-6">
      <PageHeader title="Account" />
      <dl className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2">
        <DetailItem label="Name">{user.fullName}</DetailItem>
        <DetailItem label="Email">{user.email}</DetailItem>
      </dl>
      <section className="grid gap-3">
        <h2 className="text-sm font-medium">Change password</h2>
        <PasswordForm />
      </section>
    </div>
  );
}
