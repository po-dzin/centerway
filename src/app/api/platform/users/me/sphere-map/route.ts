/**
 * GET/PUT /api/platform/users/me/sphere-map — the caller's own карта сфер.
 *
 * Private to its owner in the strictest sense this codebase has: the account
 * is the bearer token's, never an id from the request, and there is no read of
 * anybody else's map anywhere — not for an author, not for an admin. The table
 * has owner-only policies as defence in depth; this handler is the guard
 * (AGENTS.md → Database Rule).
 *
 * PUT replaces the whole map. The client sends all seven spheres and the focus
 * on every (debounced) save, and the body is validated strictly — an unknown
 * sphere, a score outside 0–10 or a fourth focus refuses the save with a code.
 */

import { NextRequest, NextResponse } from "next/server";

import { adminClient } from "@/lib/auth/adminClient";
import { requireUserFromBearer } from "@/lib/auth/requireUser";
import { validateSphereMapInput } from "@/lib/profile/sphereMap";
import { getSphereMap, saveSphereMap } from "@/lib/profile/sphereMapStore";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requireUserFromBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const map = await getSphereMap(adminClient(), user.id);
    return NextResponse.json({ map });
  } catch {
    return NextResponse.json({ error: "read_failed" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const user = await requireUserFromBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = validateSphereMapInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const map = await saveSphereMap(adminClient(), user.id, parsed.value);
    return NextResponse.json({ map });
  } catch {
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}
