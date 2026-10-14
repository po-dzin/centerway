/**
 * POST /api/lms/authoring/ledger/links — a new `?ref` link for one post.
 *
 * Body: { label, channel?, targetPath? }. The tag is derived from the author's
 * slug, the channel and the label (`proposeLinkTag`), never typed by hand.
 */

import { NextRequest, NextResponse } from "next/server";

import { createLedgerLink, findLedgerAuthor, LedgerLinkError } from "@/lib/lms/authorLedger";
import { withBuilderIdentity } from "@/lib/lms/courseAccess";
import { LMS_COURSE_WRITE } from "@/lib/lms/rateRules";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  return withBuilderIdentity(
    req,
    async (identity) => {
      const author = await findLedgerAuthor(identity.authUserId);
      if (!author) return NextResponse.json({ error: "author_profile_missing" }, { status: 403 });

      const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body) return NextResponse.json({ error: "invalid_json" }, { status: 422 });

      try {
        const link = await createLedgerLink(author, {
          label: body.label,
          channel: body.channel,
          targetPath: body.targetPath,
        });
        return NextResponse.json({ link: { ...link, orders: 0 } }, { status: 201 });
      } catch (error) {
        if (error instanceof LedgerLinkError) return NextResponse.json({ error: error.message }, { status: 422 });
        const message = error instanceof Error ? error.message : "unknown_error";
        return NextResponse.json({ error: message }, { status: 500 });
      }
    },
    LMS_COURSE_WRITE,
  );
}
