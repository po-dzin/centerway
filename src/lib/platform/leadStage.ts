/**
 * Closing a lead when the person it belongs to actually buys.
 *
 * A stage that only ever moves by hand rots, and the failure it rots into is
 * precisely the one the column was added to prevent: a follow-up sequence still
 * writing «ви цікавились консультацією» to somebody who paid last week.
 *
 * THREE DOORS MARK AN ORDER PAID and all three call this, because a rule that
 * lives in only one of them is a rule that is wrong two thirds of the time:
 * the WayForPay webhook, the manual sale in admin, and an admin reconciling an
 * existing order to `paid`.
 *
 * WHY THE SCOPE DIFFERS BY DOOR. `same_product` is right for the gateway: a
 * self-serve tripwire purchase must not silence a consultation request the
 * person is still waiting on an answer to — they did not get what they asked
 * for, so that lead is not won. `all_open` is right when a HUMAN recorded the
 * sale, because that is the concierge path this product actually runs on: the
 * founder answers a request, talks to the person, and sells them something —
 * often something other than the thing the form named. Whoever pressed the
 * button knows the conversation ended; the gateway does not.
 *
 * Only `new` and `in_progress` are touched. A closed lead is never reopened and
 * never re-closed, which also makes this idempotent — a webhook delivered twice
 * finds nothing open the second time.
 */

import { canonicalProductKey } from "@/lib/reporting/productIdentity";
import { normalizeCustomerEmail, normalizeCustomerPhone } from "@/lib/platform/customerIdentity";

type SupabaseLike = { from: (table: string) => any };

export type LeadCloseScope = "same_product" | "all_open";

export type CloseWonLeadsResult = {
  closed: number;
  reason: "closed" | "no_contact" | "nothing_open";
};

/**
 * Marks the buyer's open leads as `won`.
 *
 * Best-effort by contract: every caller is on a path where money has already
 * moved, and a bookkeeping write must never be able to fail that. Callers wrap
 * this; it also never throws on a query error, returning `nothing_open`
 * instead, so a missing column or a permissions change degrades to "the stage
 * did not move" rather than to a failed payment.
 */
export async function closeWonLeadsForPurchase(
  db: SupabaseLike,
  params: {
    email?: string | null;
    phone?: string | null;
    productCode?: string | null;
    scope: LeadCloseScope;
  }
): Promise<CloseWonLeadsResult> {
  const email = normalizeCustomerEmail(params.email);
  const phone = normalizeCustomerPhone(params.phone);
  if (!email && !phone) return { closed: 0, reason: "no_contact" };

  try {
    /* TWO EQUALITY QUERIES, NOT ONE `.or()` STRING — and this is not a style
       preference. `.or("email.eq.<v>,phone.eq.<v>")` builds a PostgREST filter
       by string concatenation, and a `+` in the value silently breaks the
       parse: the filter is not rejected, it is DISCARDED, and the query then
       returns every row in the table. Every Ukrainian phone number starts with
       `+`, so the first real purchase would have marked every open lead in the
       database as won, including other people's. Caught against production
       before this shipped: `or('email.eq.test@gmail.com,phone.eq.+3800...')`
       returned both rows in `leads`, one of which had neither value.

       Equality filters carry their values out of band, so nothing the caller
       was given can change the SHAPE of the query. */
    const openStages = ["new", "in_progress"];
    const found = new Map<string, { id: string; product_code: string | null }>();

    for (const [column, value] of [
      ["email", email],
      ["phone", phone],
    ] as const) {
      if (!value) continue;
      const { data, error } = await db
        .from("leads")
        .select("id, product_code")
        .in("stage", openStages)
        .eq(column, value);
      if (error) continue;
      for (const row of (data ?? []) as Array<{ id: string; product_code: string | null }>) {
        found.set(row.id, row);
      }
    }

    const data = [...found.values()];
    if (data.length === 0) return { closed: 0, reason: "nothing_open" };

    const paidKey = canonicalProductKey(params.productCode, "");
    const matching =
      params.scope === "all_open"
        ? data
        : data.filter((row: any) => paidKey !== "" && canonicalProductKey(row.product_code, "") === paidKey);

    const ids = matching.map((row: any) => row.id).filter(Boolean);
    if (ids.length === 0) return { closed: 0, reason: "nothing_open" };

    const { error: writeError } = await db
      .from("leads")
      .update({ stage: "won", stage_changed_at: new Date().toISOString() })
      .in("id", ids)
      /* Re-assert at write time: an operator may have closed the lead by hand
         between the read and this update, and their verdict wins. */
      .in("stage", openStages);

    if (writeError) return { closed: 0, reason: "nothing_open" };
    return { closed: ids.length, reason: "closed" };
  } catch {
    return { closed: 0, reason: "nothing_open" };
  }
}
