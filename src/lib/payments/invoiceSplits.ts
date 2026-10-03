import type { supabaseAdmin } from "@/lib/supabaseAdmin";

import type { GatewayId, PayoutSplit } from "./gateway";

type Db = ReturnType<typeof supabaseAdmin>;

/**
 * THE AUTHOR'S PART OF AN INVOICE, decided before the buyer pays (2026-10-03).
 *
 * The same rule the database applies when the order becomes paid
 * (`orders_accrue_shares`, migration 20260926010000): the offer's own
 * `share_pct` first, the author's `default_share_pct` second, rounded to the
 * kopeck. It is repeated here because a split gateway has to be told the parts
 * when the invoice is issued, and the trigger only runs after the money has
 * moved. The trigger stays the record: it writes the `order_shares` row, and
 * marks it `split_at_source` when this function routed the part.
 *
 * Empty — the whole payment to the platform, the share accrued for a manual
 * payout — whenever any piece is missing: no author, no share, no receiver at
 * this gateway, or a share that leaves the platform nothing to receive. A read
 * that fails is the same empty answer: an author's money is never lost by
 * that, only paid by hand.
 */
export async function resolveInvoiceSplits(
  db: Db,
  input: { productCode: string; amount: number; gateway: GatewayId },
): Promise<PayoutSplit[]> {
  try {
    const code = input.productCode.toLowerCase();
    type OfferRow = { id: string; experience_id: string | null; share_pct: number | null };
    let { data: offer } = await db
      .from("experience_offers")
      .select("id, experience_id, share_pct")
      .eq("code", code)
      .maybeSingle<OfferRow>();
    if (!offer) {
      const { data: alias } = await db.from("offer_aliases").select("offer_id").eq("code", code).maybeSingle();
      if (alias?.offer_id) {
        ({ data: offer } = await db
          .from("experience_offers")
          .select("id, experience_id, share_pct")
          .eq("id", alias.offer_id)
          .maybeSingle<OfferRow>());
      }
    }
    if (!offer?.experience_id) return [];

    const { data: experience } = await db
      .from("experiences")
      .select("author_profile_id, title")
      .eq("id", offer.experience_id)
      .maybeSingle();
    const authorId = experience?.author_profile_id;
    if (!authorId) return [];

    const { data: account } = await db
      .from("author_payout_accounts")
      .select("receiver_ref, gateway, default_share_pct, active")
      .eq("author_id", authorId)
      .maybeSingle();
    if (!account?.active || account.gateway !== input.gateway || !account.receiver_ref?.trim()) return [];

    const pct = Number(offer.share_pct ?? account.default_share_pct);
    if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) return [];

    const amount = Math.round(input.amount * pct) / 100;
    if (amount <= 0 || amount >= input.amount) return [];

    return [
      {
        receiverRef: account.receiver_ref.trim(),
        amount,
        description: experience?.title ? `${experience.title}: частка автора` : "Частка автора",
      },
    ];
  } catch (error) {
    console.warn("invoice_splits_read_failed", {
      productCode: input.productCode,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
