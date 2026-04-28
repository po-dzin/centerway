import { LANDING_ROUTE_CONFIG } from "@/lib/landing/config";
import { LANDING_CONTENT } from "@/lib/landing/content";
import { LandingPageShell } from "@/lib/landing/LandingPageShell";
import { prepareLandingHtml } from "@/lib/landing/prepareLandingHtml";
import type { LandingProduct } from "@/lib/landing/types";
import type { Metadata } from "next";

export function getLandingMetadata(product: LandingProduct): Metadata {
  return {
    title: LANDING_CONTENT[product].title || LANDING_ROUTE_CONFIG[product].title,
  };
}

export async function renderLandingPage(product: LandingProduct) {
  const prepared = await prepareLandingHtml({ product, pageKind: "entry" });
  return <LandingPageShell product={product} bodyHtml={prepared.bodyHtml} />;
}
