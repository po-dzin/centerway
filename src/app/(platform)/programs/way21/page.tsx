import type { Metadata } from "next";

import { ProgramDetailPage } from "@/components/platform/ProgramDetailPage";
import { OfferPurchaseReturn, readPurchaseReturn } from "@/components/platform/OfferPurchaseReturn";
import { programPageBySlug } from "@/lib/platform/content";
import { loadPayableOffer } from "@/lib/platform/offers";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Шлях 21: детокс-програма на 21 день",
  description: describe(
    "21-денна аюрведична програма розвантаження: харчування, трави, режим дня і щоденні опори. Уроки відкриваються в кабінеті, темп — ваш."
  ),
  path: "/programs/way21",
});

/**
 * Way 21 still describes itself from `content.ts`, and that is deliberate for
 * now — moving its copy into the course is a separate content pass, and this
 * file changes only because the PAYMENT return moved.
 *
 * SINCE 2026-08-26 a paid course comes back to its own offer page instead of to
 * `/pay/thanks`, and `way21` is one of the two products that fulfils a course.
 * Without the slot below, the redirect would have landed its buyers on a page
 * that shows them the sales pitch, prints no receipt, and — worse — never fires
 * the browser `Purchase`, leaving Meta with only the server-side half of every
 * Way 21 sale.
 *
 * Way 21 is sold under TWO product codes (`way21` and its guided package), and
 * both name the same course, so both arrive here. The receipt reads the code
 * out of the return parameters rather than assuming one.
 */
export default async function Way21Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const code = typeof params.product === "string" ? params.product : "way21";
  const offer = await loadPayableOffer(code);
  const returned = readPurchaseReturn(params, offer);

  return (
    <ProgramDetailPage
      program={programPageBySlug.way21}
      purchase={returned ? <OfferPurchaseReturn purchase={{ ...returned, product: code }} /> : undefined}
    />
  );
}
