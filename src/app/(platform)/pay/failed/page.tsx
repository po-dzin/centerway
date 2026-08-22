import type { Metadata } from "next";

import { PayStatusPage } from "@/components/platform/PayStatusPage";
import type { SearchParams } from "@/lib/products";

export const metadata: Metadata = {
  title: "Платіж не завершився - CenterWay",
  description: "Оплата CenterWay не пройшла: що це означає і що робити далі.",
  robots: { index: false, follow: false },
};

export default async function PayFailedPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return <PayStatusPage status="failed" searchParams={await searchParams} />;
}
