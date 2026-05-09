import { LANDING_ROUTE_CONFIG } from "@/lib/landing/config";
import { LANDING_CONTENT } from "@/lib/landing/content";
import { LandingPageShell } from "@/lib/landing/LandingPageShell";
import { prepareLandingHtml } from "@/lib/landing/prepareLandingHtml";
import type { StaticLandingProduct } from "@/lib/landing/types";
import type { Metadata } from "next";

export function getLandingMetadata(product: StaticLandingProduct): Metadata {
  const content = LANDING_CONTENT[product];
  return {
    title: content.title || LANDING_ROUTE_CONFIG[product].title,
    description: content.description,
    openGraph: {
      title: content.title || LANDING_ROUTE_CONFIG[product].title,
      description: content.description,
    },
    twitter: {
      card: "summary_large_image",
      title: content.title || LANDING_ROUTE_CONFIG[product].title,
      description: content.description,
    },
  };
}

export async function renderLandingPage(product: StaticLandingProduct) {
  const prepared = await prepareLandingHtml({ product, pageKind: "entry" });
  return <LandingPageShell product={product} bodyHtml={prepared.bodyHtml} />;
}
