import type { Metadata } from "next";

import { PayStatusPage } from "@/components/platform/PayStatusPage";
import type { SearchParams } from "@/lib/products";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Перевіряємо оплату",
  description: describe("Очікуємо підтвердження оплати CenterWay від банку.", { bounded: false }),
  noindex: true,
});

/**
 * The state that was missing between "paid" and "failed".
 *
 * The browser returns from WayForPay in a race with the server-to-server
 * callback. When the callback has not landed yet we know nothing — and the old
 * flow answered that by sending the buyer to a page asserting their money had
 * not been taken. This page says the true thing instead, and moves on by itself
 * the moment the answer arrives.
 */
export default async function PayPendingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return <PayStatusPage status="pending" searchParams={await searchParams} />;
}
