import type { ProgramFormat } from "./formats";

/**
 * The «від …» figure of a program sold in formats: the lowest price anyone
 * pays, whichever way they buy.
 *
 * ONE ANSWER FOR THE CARD AND THE PAGE (2026-10-03). The catalogue card and the
 * program's hero each computed it, and both kept only `checkout` formats. A
 * priced format bought through an enquiry is still a price: Шлях 21's
 * self-paced format went to 3 900 ₴ while it was set to «заявка», and both
 * places went on quoting the cohort's 4 100 ₴ as the lowest — a floor above
 * the cheapest way in. Every format with a price counts now.
 *
 * Null when there is nothing to choose between (fewer than two formats) or no
 * format has a price — the caller then shows the single offer as before.
 */
export function formatFloor(formats: ProgramFormat[]): { amount: number; currency: string } | null {
  if (formats.length < 2) return null;
  const priced = formats
    .filter((format) => format.amount !== null && format.amount > 0)
    .sort((a, b) => a.amount! - b.amount!);
  const lowest = priced[0];
  return lowest ? { amount: lowest.amount!, currency: lowest.currency } : null;
}
