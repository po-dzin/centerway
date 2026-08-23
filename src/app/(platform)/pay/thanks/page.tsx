import type { Metadata } from "next";

import { PayStatusPage } from "@/components/platform/PayStatusPage";
import type { SearchParams } from "@/lib/products";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Дякуємо! Оплату прийнято",
  description: describe("Підтвердження оплати CenterWay і перехід до купленого курсу.", { bounded: false }),
  // A confirmation page carries an order reference in its URL and belongs to
  // one buyer. It has no business in an index.
  noindex: true,
});

export default async function PayThanksPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return <PayStatusPage status="paid" searchParams={await searchParams} />;
}
