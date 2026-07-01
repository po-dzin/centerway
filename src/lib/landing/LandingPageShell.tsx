import { getLandingPublicRouteName, getLandingShellAssets } from "@/lib/landing/config";
import { getLandingCriticalCss } from "@/lib/landing/config";
import { LandingIremEnhancements } from "@/lib/landing/LandingIremEnhancements";
import type { LandingResolvedOffer } from "@/lib/landing/offers";
import type { StaticLandingProduct } from "@/lib/landing/types";
import Script from "next/script";

type LandingPageShellProps = {
  product: StaticLandingProduct;
  bodyHtml: string;
  offer?: LandingResolvedOffer | null;
};

export function LandingPageShell({ product, bodyHtml, offer }: LandingPageShellProps) {
  const config = getLandingShellAssets(product);
  const criticalCss = getLandingCriticalCss(product);
  const fontPreloads =
    product === "irem"
      ? [
          "/irem/fonts/Formular.woff2",
          "/irem/fonts/Formular-Bold.woff2",
          "/irem/fonts/Formular-Black.woff2",
        ]
      : [];

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: criticalCss }} />
      {fontPreloads.map((href) => (
        <link key={href} rel="preload" href={href} as="font" type="font/woff2" crossOrigin="anonymous" />
      ))}
      {config.styles.map((href) => (
        <link key={href} rel="stylesheet" href={href} />
      ))}
      <Script src={config.pixelScript} data-cw-product={product} strategy="afterInteractive" />
      {config.scripts
        .map((src) => (
          <Script
            key={src}
            src={src}
            strategy="afterInteractive"
            {...(src.includes("lazysizes.min.js") || src.includes("common.js") ? { async: true } : {})}
          />
        ))}
      <Script src={config.runtimeScript} strategy="afterInteractive" />
      {product === "irem" ? <LandingIremEnhancements /> : null}
      <main
        data-cw-landing={product}
        data-cw-runtime="next"
        data-cw-page={getLandingPublicRouteName(product)}
        data-cw-offer-id={offer?.offerId ?? undefined}
        data-cw-price-value={offer?.amount ?? undefined}
        data-cw-currency={offer?.currency ?? undefined}
        data-cw-offer-token={offer?.offerApplied ? offer.offerToken ?? undefined : undefined}
        data-cw-offer-state={offer ? (offer.offerApplied ? "active" : offer.offerExpired ? "expired" : "base") : undefined}
        data-cw-offer-issued-at={offer?.issuedAt ?? undefined}
        data-cw-offer-expires-at={offer?.expiresAt ?? undefined}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />
    </>
  );
}
