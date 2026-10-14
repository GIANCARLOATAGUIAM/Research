import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ActionForm } from "@/components/app/action-form";
import { DetailItem, SelectField, TextField } from "@/components/app/fields";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { setTemporaryPassword, setUserActive, updateUser } from "@/features/users/actions";
import { requireRole } from "@/lib/auth/dal";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "User" };

export default async function UserPage({ params }: PageProps<"/admin/users/[id]">) {
  const me = await requireRole("admin");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: u }, { data: numbers }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
    supabase.rpc("account_student_numbers"),
  ]);
  if (!u) notFound();
  const self = u.id === me.id;
  const studentNumber = numbers?.find((n) => n.profile_id === id)?.student_number;

  return (
    <div className="grid gap-5">
      <PageHeader
        title={u.full_name}
        description={u.email}
        actions={u.is_active ? <Badge className="bg-success/12 text-success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
      />

      <dl className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-3">
        <DetailItem label="Role">{ROLE_LABELS[u.role]}</DetailItem>
        {u.role === "student" ? <DetailItem label="Student number">{studentNumber ?? "Pending approval"}</DetailItem> : null}
        <DetailItem label="Created">{formatDateTime(u.created_at)}</DetailItem>
      </dl>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="grid content-start gap-3 rounded-lg border bg-card p-4">
          <h2 className="text-sm font-medium">Account details</h2>
          <ActionForm action={updateUser.bind(null, id)} submitLabel="Save">
            <TextField name="full_name" label="Full name" required maxLength={120} defaultValue={u.full_name} />
            {u.role === "student" ? (
              <p className="text-xs text-muted-foreground">Student accounts keep the Student role.</p>
            ) : self ? (
              <p className="text-xs text-muted-foreground">You cannot change the role of your own account.</p>
            ) : (
              <SelectField
                name="role"
                label="Role"
                defaultValue={u.role}
                options={[
                  { value: "clinic_staff", label: "Clinic Personnel" },
                  { value: "admin", label: "Administrator" },
                ]}
              />
            )}
          </ActionForm>
        </section>

        {self ? null : (
          <section className="grid content-start gap-3 rounded-lg border bg-card p-4">
            <h2 className="text-sm font-medium">Temporary password</h2>
            <ActionForm action={setTemporaryPassword.bind(null, id)} submitLabel="Set password" variant="outline">
              <TextField name="password" label="New temporary password" type="password" autoComplete="new-password" minLength={8} required hint="At least 8 characters." />
            </ActionForm>
          </section>
        )}
      </div>

      {self ? (
        <p className="text-xs text-muted-foreground">You cannot deactivate your own account.</p>
      ) : (
        <section className="grid gap-2 border-t pt-4">
          <h2 className="text-sm font-medium">Access</h2>
          <p className="text-sm text-muted-foreground">
            {u.is_active
              ? "Deactivating removes all access at once and blocks sign-in. Records the user created are kept."
              : "This account cannot sign in or see any data."}
          </p>
          <ActionForm
            action={setUserActive.bind(null, id, !u.is_active)}
            submitLabel={u.is_active ? "Deactivate account" : "Reactivate account"}
            variant={u.is_active ? "destructive" : "outline"}
            confirm={
              u.is_active
                ? { message: `Deactivate ${u.full_name}? They lose access immediately and can no longer sign in.`, confirmLabel: "Yes, deactivate" }
                : undefined
            }
          />
        </section>
      )}
    </div>
  );
}
