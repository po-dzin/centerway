/**
 * Where a purchase is collected — one answer, for everyone who has to give it.
 *
 * WHY THIS FILE EXISTS. Three surfaces tell a buyer where their thing is: the
 * receipt email, the pay-status page, and the operator's "resend access"
 * button in the admin. The first two derived it from `ProductFulfilment`; the
 * third guessed, and guessed wrong for the whole life of the feature — it
 * copied `/pay/return?token=…`, a URL that route has never read, so the person
 * an operator was trying to rescue landed on «Платіж не завершився». The
 * comment above that line said "assuming … or something similar", which is
 * exactly as much verification as it had.
 *
 * A guess is possible only while the true answer lives inside somebody else's
 * module. So it moved here, out of `purchaseEmail`, and the admin route reads
 * the same function the receipt does. A future surface that needs the link
 * imports it; it does not reconstruct it.
 */

import { PROFILE_PATH_PREFIX, surfaceUrl } from "@/lib/surfaces/catalog";
import type { adminClient } from "@/lib/auth/adminClient";
import { describeOffer, offerFulfilment } from "@/lib/experiences/offers";
import type { ProductFulfilment } from "@/lib/products";
import { parseCourseOfferCode } from "@/lms-core/offerCode";

/**
 * ABSOLUTE, always. Two of the three callers render into a mail client or a
 * clipboard, neither of which has an origin to be relative to.
 */
export function fulfilmentDestination(fulfilment: ProductFulfilment): { href: string; label: string } {
  if (fulfilment.kind === "bot") return { href: fulfilment.url, label: "Відкрити бот" };
  if (fulfilment.kind === "course") {
    return { href: surfaceUrl(`/learn/${fulfilment.courseSlug}`), label: "Перейти до курсу" };
  }
  return { href: surfaceUrl(PROFILE_PATH_PREFIX), label: "Перейти в кабінет" };
}

/**
 * What an ORDER delivers, from the code stored on the row.
 *
 * Through `describeOffer`, the one channel from a code to an offer, because the
 * codes on old rows are not the codes offers carry now — `reboot`, `irem`,
 * `ideal_body` and the rest were live long enough to be stored, and an operator
 * opening a 2026-03 order is exactly the person who must not be handed the
 * cabinet by default. Those spellings are rows of `offer_aliases`; a second
 * table of them here would drift the moment either changed.
 *
 * A `course:<slug>` code still answers when the database does not — the slug
 * is the address. Anything unrecognised falls to the cabinet rather than to an
 * error: a buyer helped by an operator is better served by the page that lists
 * everything they own than by an error message.
 */
export async function orderFulfilment(
  db: ReturnType<typeof adminClient>,
  productCode: string | null | undefined,
): Promise<ProductFulfilment> {
  try {
    const target = await describeOffer(db, productCode);
    if (target) return offerFulfilment(target);
  } catch (error) {
    console.warn("order_fulfilment_read_failed", { error: error instanceof Error ? error.message : String(error) });
  }

  const courseSlug = parseCourseOfferCode(productCode);
  if (courseSlug) return { kind: "course", courseSlug };
  return { kind: "cabinet" };
}
