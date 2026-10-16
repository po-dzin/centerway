/**
 * GET /api/lms/authoring/ledger?period=7|30|all — the author's «Облік».
 *
 * The caller's OWN author row only, admin or not: the ledger answers «what did
 * my work earn», and an admin without a byline has no answer to give here (the
 * house reads `order_shares` in the admin panel). No buyer identity crosses
 * this boundary — see `src/lib/lms/authorLedger.ts`.
 */

import { NextRequest, NextResponse } from "next/server";

import {
  findLedgerAuthor,
  ledgerBySource,
  listLedgerLinks,
  ordersByTag,
  readLedgerRows,
  summarizeLedger,
} from "@/lib/lms/authorLedger";
import { listCoursesByAuthor } from "@/lib/lms/authors";
import { withBuilderIdentity } from "@/lib/lms/courseAccess";
import { LMS_AUTHORING_READ } from "@/lib/lms/rateRules";
import { PLATFORM_ORIGIN } from "@/lib/surfaces/catalog";

export const runtime = "nodejs";

const PERIOD_DAYS: Record<string, number | null> = { "7": 7, "30": 30, all: null };
/** The sales list is the recent answer; the full record is the CSV. */
const ROWS_SHOWN = 50;

export async function GET(req: NextRequest) {
  return withBuilderIdentity(
    req,
    async (identity) => {
      try {
        const author = await findLedgerAuthor(identity.authUserId);
        if (!author) return NextResponse.json({ author: null });

        const period = req.nextUrl.searchParams.get("period") ?? "30";
        const days = PERIOD_DAYS[period] === undefined ? 30 : PERIOD_DAYS[period];
        const since = days === null ? null : new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

        const [rows, allRows, links, courses] = await Promise.all([
          readLedgerRows(author.id, since),
          readLedgerRows(author.id, null),
          listLedgerLinks(author.id),
          listCoursesByAuthor(author.id).catch(() => []),
        ]);
        const counts = ordersByTag(allRows);

        return NextResponse.json({
          author: { slug: author.slug, name: author.name },
          origin: PLATFORM_ORIGIN,
          totals: summarizeLedger(rows),
          sources: ledgerBySource(rows, links),
          rows: rows.slice(0, ROWS_SHOWN),
          rowsTotal: rows.length,
          links: links.map((link) => ({ ...link, orders: counts.get(link.tag) ?? 0 })),
          destinations: [
            { path: `/expert/${author.slug}`, label: "Ваша сторінка автора" },
            ...courses.map((course) => ({ path: `/programs/${course.programSlug}`, label: course.title })),
          ],
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown_error";
        return NextResponse.json({ error: message }, { status: 500 });
      }
    },
    LMS_AUTHORING_READ,
  );
}
