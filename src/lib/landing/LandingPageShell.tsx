import { getLandingPageName, getLandingShellAssets } from "@/lib/landing/config";
import type { LandingProduct } from "@/lib/landing/types";
import Script from "next/script";

type LandingPageShellProps = {
  product: LandingProduct;
  bodyHtml: string;
};

export function LandingPageShell({ product, bodyHtml }: LandingPageShellProps) {
  const config = getLandingShellAssets(product);

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
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
      <main
        data-cw-landing={product}
        data-cw-runtime="next"
        data-cw-page={getLandingPageName(product)}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />
    </>
  );
}
