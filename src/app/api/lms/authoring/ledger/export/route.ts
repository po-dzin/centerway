/**
 * GET /api/lms/authoring/ledger/export?month=YYYY-MM — the month's ledger as CSV.
 *
 * For the author's bookkeeper: one row per order, the share and its state.
 * Without `month`, every row the author has.
 */

import { NextRequest, NextResponse } from "next/server";

import { findLedgerAuthor, ledgerCsv, readLedgerRows } from "@/lib/lms/authorLedger";
import { withBuilderIdentity } from "@/lib/lms/courseAccess";
import { LMS_AUTHORING_READ } from "@/lib/lms/rateRules";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  return withBuilderIdentity(
    req,
    async (identity) => {
      const author = await findLedgerAuthor(identity.authUserId);
      if (!author) return NextResponse.json({ error: "author_profile_missing" }, { status: 403 });

      const month = req.nextUrl.searchParams.get("month");
      if (month !== null && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
        return NextResponse.json({ error: "month_invalid" }, { status: 422 });
      }

      try {
        const rows = (await readLedgerRows(author.id, month ? `${month}-01` : null)).filter(
          (row) => month === null || row.createdAt.startsWith(month),
        );
        return new NextResponse(ledgerCsv(rows), {
          status: 200,
          headers: {
            "content-type": "text/csv; charset=utf-8",
            "content-disposition": `attachment; filename="oblik-${author.slug}-${month ?? "all"}.csv"`,
            "cache-control": "no-store",
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown_error";
        return NextResponse.json({ error: message }, { status: 500 });
      }
    },
    LMS_AUTHORING_READ,
  );
}
