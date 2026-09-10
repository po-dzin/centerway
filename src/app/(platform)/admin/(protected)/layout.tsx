import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { staffFromCookies } from "@/lib/auth/serverSession";

/**
 * Every admin page but the index lives under this group, and this is the
 * gate: no staff session in the cookie, no render — a 307 to /admin, where
 * the person signs in or is told they may not. The API routes keep their own
 * Bearer check; this is the page-level one, and it runs before hydration
 * rather than after it.
 */
export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  const staff = await staffFromCookies();
  if (!staff) redirect("/admin");
  return <>{children}</>;
}
