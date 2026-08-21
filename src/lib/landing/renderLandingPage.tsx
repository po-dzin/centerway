import { getLandingPublicEntryPath, LANDING_ROUTE_CONFIG } from "@/lib/landing/config";
import { LANDING_CONTENT } from "@/lib/landing/content";
import { resolveIremLandingOffer } from "@/lib/landing/offers";
import { LandingPageShell } from "@/lib/landing/LandingPageShell";
import { prepareLandingHtml } from "@/lib/landing/prepareLandingHtml";
import type { StaticLandingProduct } from "@/lib/landing/types";
import type { SearchParams } from "@/lib/products";
import type { Metadata } from "next";

/** Baked by scripts/brand-mark-bake.mjs. */
const BRAND_COVER = "/cw/brand/cw-og-cover.png";

export function getLandingMetadata(product: StaticLandingProduct): Metadata {
  const content = LANDING_CONTENT[product];
  const canonicalPath = getLandingPublicEntryPath(product);
  return {
    title: content.title || LANDING_ROUTE_CONFIG[product].title,
    description: content.description,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title: content.title || LANDING_ROUTE_CONFIG[product].title,
      description: content.description,
      url: canonicalPath,
      // The brand card is the floor, not the ceiling: a landing with its own
      // hero shot should override this. Without it the card declared below had
      // nothing to show and previews came out blank.
      images: [{ url: BRAND_COVER, width: 1200, height: 630, alt: "CenterWay" }],
    },
    twitter: {
      card: "summary_large_image",
      title: content.title || LANDING_ROUTE_CONFIG[product].title,
      description: content.description,
      images: [BRAND_COVER],
    },
  };
}

export async function renderLandingPage(product: StaticLandingProduct, searchParams?: SearchParams) {
  const offer = product === "irem" ? await resolveIremLandingOffer(searchParams ?? null) : null;
  const prepared = await prepareLandingHtml({ product, pageKind: "entry", offer });
  return <LandingPageShell product={product} bodyHtml={prepared.bodyHtml} offer={offer} />;
}
