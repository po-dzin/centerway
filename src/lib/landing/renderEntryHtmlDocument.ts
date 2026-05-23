import { getLandingCriticalCss, getLandingPublicRouteName, getLandingShellAssets } from "@/lib/landing/config";
import type { LandingResolvedOffer } from "@/lib/landing/offers";
import type { StaticLandingProduct } from "@/lib/landing/types";

type RenderEntryHtmlDocumentInput = {
  product: StaticLandingProduct;
  bodyHtml: string;
  offer?: LandingResolvedOffer | null;
  title?: string | null;
  description?: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function dataAttr(name: string, value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }
  return ` ${name}="${escapeHtml(String(value))}"`;
}

export function renderEntryHtmlDocument(input: RenderEntryHtmlDocumentInput): string {
  const { product, bodyHtml, offer, title, description } = input;
  const config = getLandingShellAssets(product);
  const criticalCss = getLandingCriticalCss(product);
  const page = getLandingPublicRouteName(product);

  const styles = config.styles.map((href) => `<link rel="stylesheet" href="${href}">`).join("\n");
  const scripts = config.scripts
    .map((src) => {
      const asyncAttr = src.includes("lazysizes.min.js") || src.includes("common.js") ? " async" : "";
      return `<script src="${src}"${asyncAttr}></script>`;
    })
    .join("\n");

  const mainAttrs = [
    dataAttr("data-cw-landing", product),
    dataAttr("data-cw-runtime", "next"),
    dataAttr("data-cw-page", page),
    dataAttr("data-cw-offer-id", offer?.offerId ?? undefined),
    dataAttr("data-cw-price-value", offer?.amount ?? undefined),
    dataAttr("data-cw-currency", offer?.currency ?? undefined),
    dataAttr("data-cw-offer-token", offer?.offerApplied ? offer.offerToken ?? undefined : undefined),
    dataAttr(
      "data-cw-offer-state",
      offer ? (offer.offerApplied ? "active" : offer.offerExpired ? "expired" : "base") : undefined
    ),
    dataAttr("data-cw-offer-issued-at", offer?.issuedAt ?? undefined),
    dataAttr("data-cw-offer-expires-at", offer?.expiresAt ?? undefined),
  ].join("");

  return `<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title || "")}</title>
  ${description ? `<meta name="description" content="${escapeHtml(description)}">` : ""}
  <style>${criticalCss}</style>
  ${styles}
</head>
<body>
  <script src="${config.pixelScript}" data-cw-product="${product}"></script>
  <main${mainAttrs}>${bodyHtml}</main>
  ${scripts}
  <script src="${config.runtimeScript}" defer></script>
</body>
</html>`;
}
