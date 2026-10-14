/**
 * What the checkout page says about the thing being bought.
 *
 * WHY A PAGE AND NOT A DIALOG (owner, 2026-10-14). The pre-payment step was a
 * dialog injected by the landing script, on its own skin: one field over a
 * dimmed landing, no product, no price. Every platform that sells online
 * (Stripe Checkout, Shopify, Udemy, Teachable) gives this moment a page of its
 * own — what you are buying and for how much on one side, where to send it on
 * the other — so the buyer confirms the order before the gateway takes over.
 *
 * ONE FACT, ONE SOURCE. The figures are the offer row's, through
 * `loadPayableOffer` — the same function `/api/pay/start` charges from — and
 * the list of what is included is `purchaseIncludes`, which the program page's
 * own checkout panel prints. The checkout cannot promise a different thing
 * from the page that sent the buyer here.
 */

import { getLiveCourse } from "@/lib/lms/liveCatalog";
import { describeOffer } from "@/lib/experiences/offers";
import { FORMAT_DEFAULT_LABELS, isOfferFormat } from "@/lib/experiences/formats";
import { isContentKind } from "@/lib/experiences/registry";
import { offerName } from "@/lib/platform/offerPreview";
import { loadPayableOffer } from "@/lib/platform/offers";
import { formatPrice, type PayableProductCode } from "@/lib/products";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { purchaseIncludes } from "@/lib/platform/purchaseIncludes";

export type CheckoutSummary = {
  code: PayableProductCode;
  /** The short name a card and a button carry. */
  title: string;
  /** The format of a program sold in several («Група», «Самостійно»), when it is one. */
  formatLabel: string | null;
  cover: { src: string; alt: string } | null;
  price: string;
  /** Former public price, only when it is strictly higher than `price`. */
  compareAtPrice: string | null;
  includes: string[];
  /** The page that sells this offer on the platform — where «Назад» goes when there is no history. */
  offerHref: string;
};

/**
 * Everything the checkout page prints for one code, or null when the code is
 * not on sale — the same null `/api/pay/start` answers with a 404, so the page
 * never shows a form the payment route would refuse.
 */
export async function loadCheckoutSummary(code: unknown): Promise<CheckoutSummary | null> {
  const payable = await loadPayableOffer(code);
  if (!payable) return null;

  let target: Awaited<ReturnType<typeof describeOffer>> = null;
  try {
    target = await describeOffer(supabaseAdmin(), payable.code);
  } catch {
    target = null;
  }

  const course =
    target && isContentKind(target.experience.kind) && target.course ? await getLiveCourse(target.course.slug) : null;
  const offer = target?.offer ?? null;
  const formatLabel =
    offer && offer.format && offer.format !== "self"
      ? (offer.label ?? (isOfferFormat(offer.format) ? FORMAT_DEFAULT_LABELS[offer.format] : null))
      : null;

  const title = course ? offerName(course.title) : (target?.experience.title ?? payable.heading.uk);
  const offerHref = course
    ? `/programs/${course.programSlug}`
    : target
      ? `/products/${target.experience.slug}`
      : "/programs";

  return {
    code: payable.code,
    title,
    formatLabel,
    cover: course?.cover ? { src: course.cover.src, alt: course.cover.alt || title } : null,
    price: formatPrice(payable.amount, payable.currency),
    compareAtPrice:
      payable.listAmount !== null && payable.listAmount > payable.amount
        ? formatPrice(payable.listAmount, payable.currency)
        : null,
    includes: purchaseIncludes({ course, duration: null }),
    offerHref,
  };
}
