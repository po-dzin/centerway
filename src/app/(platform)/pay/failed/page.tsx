import type { Metadata } from "next";

import { PayStatusPage } from "@/components/platform/PayStatusPage";
import type { SearchParams } from "@/lib/products";
import { describe } from "@/lib/brand/identity";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Платіж не завершився",
  description: describe("Оплата CenterWay не пройшла: що це означає і що робити далі.", { bounded: false }),
  noindex: true,
});

export default async function PayFailedPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return <PayStatusPage status="failed" searchParams={await searchParams} />;
}
