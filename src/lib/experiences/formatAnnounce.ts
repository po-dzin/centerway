/**
 * «Автор пропонує формат і ціну» — said to the house, once, when it happens.
 *
 * The same gap `lib/lms/reviewAnnounce.ts` closed for courses, one step later
 * in the same journey. A course sent for review reached the group; the price
 * the author then proposed for it wrote `review_status = 'proposed'` and
 * waited in the Formats tab of `/admin/catalog` until somebody happened to open
 * it (meta-audit 2026-09-30). A course nobody can buy is still a course nobody
 * can buy, however promptly its text was approved.
 *
 * Not for an admin's own proposal, for the reason `reviewAnnounce` gives: an
 * admin proposing is an admin about to approve, and nobody is waiting.
 */

import { surfaceUrl } from "@/lib/surfaces/catalog";
import { notifyHouseThread, type HouseNotice } from "@/lib/telegram/houseThread";

export type FormatProposal = {
  courseSlug: string;
  courseTitle: string;
  /** The format's own name, or its default label. */
  formatLabel: string;
  /** In whole hryvnias; `null` when the author sent the format without a price. */
  proposedAmount: number | null;
  currency: string;
  /** A new price beside a format already on sale, as against a first proposal. */
  isPriceChange: boolean;
};

/** The message, as plain text. Pure, so the wording is testable without a Telegram token. */
export function formatProposalNotice(proposal: FormatProposal): string {
  const price =
    proposal.proposedAmount === null
      ? "Ціну автор не вказав."
      : `Ціна: ${proposal.proposedAmount} ${proposal.currency === "UAH" ? "грн" : proposal.currency}`;
  return [
    "💰 Формат на погодження",
    `${proposal.courseTitle} (${proposal.courseSlug}) · ${proposal.formatLabel}`,
    price,
    proposal.isPriceChange
      ? "Нова ціна для формату, що вже продається. Покупці бачать стару, доки нову не затвердять."
      : "Формат ще не продається.",
    "",
    surfaceUrl("/admin/catalog"),
  ].join("\n");
}

/** Announces a proposal, unless the person proposing is the person who approves. Never throws. */
export async function announceFormatProposed(
  proposal: FormatProposal & { actorIsAdmin: boolean },
): Promise<HouseNotice | "skipped_admin"> {
  if (proposal.actorIsAdmin) return "skipped_admin";
  return notifyHouseThread(formatProposalNotice(proposal));
}
