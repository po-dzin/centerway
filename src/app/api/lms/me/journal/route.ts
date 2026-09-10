/**
 * GET /api/lms/me/journal — everything this reader has written, newest first.
 *
 * Same Bearer contract as the rest of /api/lms/*, for the same reason: a native
 * reader and a Mini App must be able to open the journal without a second
 * implementation of it.
 *
 * There is no `courseSlug` and there is no way to ask for somebody else's
 * journal: the only input is the token, and the enrollments it resolves to are
 * chosen by `loadJournal`. Read-only — reading your own notes starts no clock
 * and renews no window.
 */

import { NextRequest, NextResponse } from "next/server";

import { requireUserFromBearer } from "@/lib/auth/requireUser";
import { loadJournal } from "@/lib/lms/journal";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = await requireUserFromBearer(req.headers.get("authorization"));
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const journal = await loadJournal({
    authUserId: user.id,
    email: user.email ?? null,
    emailVerified: Boolean(user.email_confirmed_at),
  });

  return NextResponse.json(journal);
}
