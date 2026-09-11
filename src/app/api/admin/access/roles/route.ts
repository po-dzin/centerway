import { NextResponse } from "next/server";
import { z } from "zod";

import { GRANTABLE_ROLES, setRole } from "@/lib/admin/access";
import { parseBody, withRoute } from "@/lib/api/route";
import { forbiddenResponse, requireAdminSession, unauthorizedResponse } from "@/lib/api/adminRoute";

const Body = z.object({
  email: z.string().trim().min(1),
  role: z.enum(GRANTABLE_ROLES),
});

/**
 * POST /api/admin/access/roles { email, role }
 *
 * There is no GET any more. It backed a Roles TABLE — the accounts holding an
 * elevated role — and that table was the accounts list filtered by an attribute
 * of the account, which is a facet rather than a tab. `/access/accounts?role=`
 * answers it now, from the one list, so this route is only the write.
 * See docs/admin-access-shape-2026-08-28.md.
 *
 * An `AccessError` thrown by `setRole` becomes its own status through
 * `withRoute`; nothing here catches.
 */
export const POST = withRoute("admin.access.roles", async (req) => {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();
  // `support` may read the role map and hand out course access, but handing
  // out roles — including admin — stays with admin.
  if (session.role !== "admin") return forbiddenResponse();

  const parsed = await parseBody(req, Body);
  if (!parsed.ok) return parsed.response;

  const result = await setRole({ email: parsed.data.email, role: parsed.data.role, actorId: session.user.id });
  return NextResponse.json({
    email: result.account.email,
    previous: result.previous,
    role: result.role,
  });
});
