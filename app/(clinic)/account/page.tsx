import type { Metadata } from "next";

import { DetailItem } from "@/components/app/fields";
import { PageHeader } from "@/components/app/page-header";
import { PasswordForm } from "@/features/account/password-form";
import { requireRole } from "@/lib/auth/dal";
import { ROLE_LABELS } from "@/lib/auth/roles";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireRole("admin", "clinic_staff");
  return (
    <div className="grid gap-5">
      <PageHeader title="Account" />
      <dl className="grid max-w-xl gap-4 rounded-lg border bg-card p-4 sm:grid-cols-3">
        <DetailItem label="Name">{user.fullName}</DetailItem>
        <DetailItem label="Email">{user.email}</DetailItem>
        <DetailItem label="Role">{ROLE_LABELS[user.role]}</DetailItem>
      </dl>
      <section className="grid gap-3">
        <h2 className="text-sm font-medium">Change password</h2>
        <PasswordForm />
      </section>
    </div>
  );
}
