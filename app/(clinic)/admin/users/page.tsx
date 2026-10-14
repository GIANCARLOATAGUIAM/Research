import type { Metadata } from "next";
import Link from "next/link";
import { UserPlus } from "lucide-react";

import { FilterBar, FilterSelect, SearchInput, TableEmpty, param } from "@/components/app/list-controls";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requireRole } from "@/lib/auth/dal";
import { ROLE_LABELS, isRole } from "@/lib/auth/roles";
import { ilikeAny, searchTerm } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const me = await requireRole("admin");
  const sp = await searchParams;
  const q = searchTerm(param(sp, "q"));
  const role = param(sp, "role");
  const status = param(sp, "status");

  const supabase = await createClient();
  let query = supabase.from("profiles").select("id, full_name, email, role, is_active, student_id").order("full_name").limit(500);
  if (q) query = query.or(ilikeAny(["full_name", "email"], q));
  if (role && isRole(role)) query = query.eq("role", role);
  if (status === "active") query = query.eq("is_active", true);
  if (status === "inactive") query = query.eq("is_active", false);
  const [{ data: users, error }, { data: numbers }] = await Promise.all([query, supabase.rpc("account_student_numbers")]);
  const numberFor = new Map((numbers ?? []).map((n) => [n.profile_id, n.student_number]));

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Users"
        description="Accounts, roles, and access."
        actions={
          <Button asChild>
            <Link href="/admin/users/new">
              <UserPlus />
              New user
            </Link>
          </Button>
        }
      />

      <FilterBar>
        <SearchInput defaultValue={param(sp, "q")} placeholder="Name or email" />
        <FilterSelect
          name="role"
          label="Role"
          defaultValue={role}
          options={[{ value: "", label: "All roles" }, ...Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))]}
          className="sm:w-44"
        />
        <FilterSelect
          name="status"
          label="Status"
          defaultValue={status}
          options={[
            { value: "", label: "Any status" },
            { value: "active", label: "Active" },
            { value: "inactive", label: "Inactive" },
          ]}
          className="sm:w-36"
        />
      </FilterBar>

      {error ? (
        <p className="text-sm text-destructive">Could not load users. Please reload the page.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden sm:table-cell">Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden md:table-cell">Student number</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users?.length ? (
              users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <Link href={`/admin/users/${u.id}`} className="font-medium hover:underline">
                      {u.full_name}
                    </Link>
                    {u.id === me.id ? <span className="ml-1.5 text-xs text-muted-foreground">(you)</span> : null}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground sm:table-cell">{u.email}</TableCell>
                  <TableCell>{ROLE_LABELS[u.role]}</TableCell>
                  <TableCell className="hidden font-mono text-xs md:table-cell">
                    {u.role === "student" ? (numberFor.get(u.id) ?? "Pending approval") : "—"}
                  </TableCell>
                  <TableCell>
                    {u.is_active ? <Badge className="bg-success/12 text-success">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableEmpty colSpan={5}>No users found.</TableEmpty>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
