import { redirect } from "next/navigation";

import { staffFromCookies, userFromCookies } from "@/lib/auth/serverSession";

import { AdminGate } from "./AdminGate";

/**
 * /admin is a door, not a page. Staff are sent straight to the dashboard;
 * everyone else sees the gate — signed out, the sign-in card; signed in
 * without a staff role, the refusal. Decided here, on the server, from the
 * session cookie; the client island only reacts to the sign-in completing.
 */
export default async function AdminRootPage() {
  const staff = await staffFromCookies();
  if (staff) redirect("/admin/analytics");
  const user = await userFromCookies();
  return <AdminGate signedInAs={user?.email ?? null} />;
}
