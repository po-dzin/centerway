import { NextRequest, NextResponse } from "next/server";

import { listCustomers, listCustomerTagOptions } from "@/lib/admin/customers";
import { parseLimitOffset, requireAdminSession, serverErrorResponse, unauthorizedResponse } from "@/lib/api/adminRoute";

// GET /api/admin/customers?q=...&tag=...&limit=...&offset=...
// GET /api/admin/customers?tags=1 — the tags in use, for the filter
export async function GET(req: NextRequest) {
  const session = await requireAdminSession(req);
  if (!session) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const { limit, offset } = parseLimitOffset(searchParams, { defaultLimit: 50, maxLimit: 100 });
  try {
    if (searchParams.get("tags") === "1") return NextResponse.json({ tags: await listCustomerTagOptions() });
    return NextResponse.json(
      await listCustomers({ q: searchParams.get("q") ?? "", tag: searchParams.get("tag") ?? "", limit, offset }),
    );
  } catch (error) {
    return serverErrorResponse(error instanceof Error ? error.message : "customers_failed");
  }
}
