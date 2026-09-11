import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export async function requireAdminSession(req: NextRequest) {
  return requireAdmin(req);
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbiddenResponse() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export function badRequestResponse(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

export function serverErrorResponse(error: string) {
  return NextResponse.json({ error }, { status: 500 });
}

/**
 * `?limit=` and `?offset=` for an admin list, from a query string that may hold
 * anything at all.
 *
 * WHY THIS IS NOT `Number(...)` ANY MORE. Both values go straight into
 * `.range(offset, offset + limit - 1)`, and against the real database:
 *
 *   ?limit=abc   → NaN → an EMPTY LIST, with no error. The worst of the three,
 *                  because an operator reads it as "there is nothing here" and
 *                  stops working a queue that is not empty.
 *   ?offset=abc  → NaN → the same silent empty list.
 *   ?limit=-5    → "Requested range not satisfiable", a 500 from a link.
 *
 * A malformed number is not a request for zero rows; it is a request that said
 * nothing, so it falls back to the default. Anything unusable is clamped rather
 * than obeyed — this is a page size, and there is no reading of a negative one
 * that an operator meant.
 */
export function parseLimitOffset(
  searchParams: URLSearchParams,
  { defaultLimit, maxLimit }: { defaultLimit: number; maxLimit: number },
) {
  const asCount = (raw: string | null, fallback: number): number => {
    if (raw === null || raw.trim() === "") return fallback;
    const value = Number(raw);
    if (!Number.isFinite(value)) return fallback;
    return Math.floor(value);
  };

  const limit = Math.min(Math.max(asCount(searchParams.get("limit"), defaultLimit), 1), maxLimit);
  const offset = Math.max(asCount(searchParams.get("offset"), 0), 0);
  return { limit, offset };
}
