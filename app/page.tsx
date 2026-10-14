import { redirect } from "next/navigation";

import { getAuthState } from "@/lib/auth/dal";
import { ROLE_HOME } from "@/lib/auth/roles";

// Entry point: send each user to the home page for their role.
export default async function Home() {
  const state = await getAuthState();

  if (state.status !== "ok") redirect("/login");

  redirect(ROLE_HOME[state.user.role]);
}
