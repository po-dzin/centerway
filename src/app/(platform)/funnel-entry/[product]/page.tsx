import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { GeneratedRouteScreen } from "@/components/generator/GeneratedRouteScreen";
import type { ScreenRouteKey } from "@/lib/generator/types";

const FUNNEL_ROUTE_MAP = {
  consult: "consult",
  detox: "detox",
  herbs: "herbs",
} satisfies Record<string, ScreenRouteKey>;

function isGeneratedFunnelProduct(value: string): value is keyof typeof FUNNEL_ROUTE_MAP {
  return value === "consult" || value === "detox" || value === "herbs";
}

type FunnelEntryPageProps = {
  params: Promise<{
    product: string;
  }>;
};

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default async function FunnelEntryPage({ params }: FunnelEntryPageProps) {
  const { product } = await params;
  if (!isGeneratedFunnelProduct(product)) {
    notFound();
  }

  return <GeneratedRouteScreen routeKey={FUNNEL_ROUTE_MAP[product]} />;
}
