import type { supabaseAdmin } from "@/lib/supabaseAdmin";

import type { GatewayId, PayoutSplit } from "./gateway";

type Db = ReturnType<typeof supabaseAdmin>;

/** Where the buyer came from, as the ledger records it (`order_shares.source`). */
export type ShareSource = "author" | "platform";

/** The share fixed on the order at invoice time (`orders.author_share_pct`). */
export type ShareSnapshot = { pct: number; source: ShareSource };

/**
 * THE AUTHOR'S PART OF AN INVOICE, decided before the buyer pays (2026-10-03).
 *
 * The same rule the database applies when the order becomes paid
 * (`orders_accrue_shares`, migration 20261014160000): a buyer who came through
 * one of the author's own links (`author_links`, matched on `?ref`) earns the
 * author's `own_share_pct`; everyone else earns the platform-traffic share —
 * the offer's own `share_pct` first, the author's `default_share_pct` second.
 * Rounded to the kopeck. It is repeated here because a split gateway has to be
 * told the parts when the invoice is issued, and the trigger only runs after
 * the money has moved.
 *
 * THE SNAPSHOT (2026-10-14). Whatever share this function decided is returned
 * beside the splits and written onto the order, and the trigger takes it first.
 * Without it an offer whose share changed between invoice and payment would
 * record one amount in `order_shares` while LiqPay had already sent another.
 *
 * Empty splits — the whole payment to the platform, the share accrued for a
 * manual payout — whenever any piece is missing: no author, no share, no
 * receiver at this gateway, or a share that leaves the platform nothing to
 * receive. A read that fails is the same empty answer: an author's money is
 * never lost by that, only paid by hand.
 */
export async function resolveInvoiceShare(
  db: Db,
  input: { productCode: string; amount: number; gateway: GatewayId; ref?: string | null },
): Promise<{ splits: PayoutSplit[]; snapshot: ShareSnapshot | null }> {
  const none = { splits: [], snapshot: null };
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
    if (!offer?.experience_id) return none;

    const { data: experience } = await db
      .from("experiences")
      .select("author_profile_id, title")
      .eq("id", offer.experience_id)
      .maybeSingle();
    const authorId = experience?.author_profile_id;
    if (!authorId) return none;

    const { data: account } = await db
      .from("author_payout_accounts")
      .select("receiver_ref, gateway, default_share_pct, own_share_pct, active")
      .eq("author_id", authorId)
      .maybeSingle();
    const active = account?.active === true;

    let source: ShareSource = "platform";
    if (input.ref) {
      const { data: link } = await db
        .from("author_links")
        .select("tag")
        .eq("tag", input.ref)
        .eq("author_id", authorId)
        .maybeSingle();
      if (link) source = "author";
    }

    const platformPct = offer.share_pct ?? (active ? account?.default_share_pct : null) ?? null;
    const ownPct = active ? (account?.own_share_pct ?? null) : null;
    const pct = Number(source === "author" ? (ownPct ?? platformPct) : platformPct);
    if (!Number.isFinite(pct) || pct <= 0) return none;

    const snapshot: ShareSnapshot = { pct, source };
    if (!active || account?.gateway !== input.gateway || !account.receiver_ref?.trim()) return { splits: [], snapshot };
    if (pct >= 100) return { splits: [], snapshot };

    const amount = Math.round(input.amount * pct) / 100;
    if (amount <= 0 || amount >= input.amount) return { splits: [], snapshot };

    return {
      splits: [
        {
          receiverRef: account.receiver_ref.trim(),
          amount,
          description: experience?.title ? `${experience.title}: частка автора` : "Частка автора",
        },
      ],
      snapshot,
    };
  } catch (error) {
    console.warn("invoice_splits_read_failed", {
      productCode: input.productCode,
      error: error instanceof Error ? error.message : String(error),
    });
    return none;
  }
}

/** The splits alone, for callers that do not record the snapshot. */
export async function resolveInvoiceSplits(
  db: Db,
  input: { productCode: string; amount: number; gateway: GatewayId; ref?: string | null },
): Promise<PayoutSplit[]> {
  return (await resolveInvoiceShare(db, input)).splits;
}
