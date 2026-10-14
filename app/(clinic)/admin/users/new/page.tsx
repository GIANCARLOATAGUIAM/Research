import type { Metadata } from "next";

import { PageHeader } from "@/components/app/page-header";
import { CreateUserForm } from "@/features/users/create-user-form";
import { requireRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "New user" };

export default async function NewUserPage() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data: students } = await supabase.rpc("students_without_account");

  return (
    <div className="grid gap-5">
      <PageHeader title="New user" description="Create an account for clinic personnel, an administrator, or a student." />
      <CreateUserForm students={students ?? []} />
    </div>
  );
}
