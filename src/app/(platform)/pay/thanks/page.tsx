import type { Metadata } from "next";

import { PayStatusPage } from "@/components/platform/PayStatusPage";
import type { SearchParams } from "@/lib/products";

export const metadata: Metadata = {
  title: "Дякуємо! Оплату прийнято - CenterWay",
  description: "Підтвердження оплати CenterWay і перехід до купленого курсу.",
  // A confirmation page carries an order reference in its URL and belongs to
  // one buyer. It has no business in an index.
  robots: { index: false, follow: false },
};

export default async function PayThanksPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return <PayStatusPage status="paid" searchParams={await searchParams} />;
}
