import { getLandingPublicRouteName, getLandingShellAssets } from "@/lib/landing/config";
import { getLandingCriticalCss } from "@/lib/landing/config";
import type { StaticLandingProduct } from "@/lib/landing/types";
import Script from "next/script";

type LandingPageShellProps = {
  product: StaticLandingProduct;
  bodyHtml: string;
};

export function LandingPageShell({ product, bodyHtml }: LandingPageShellProps) {
  const config = getLandingShellAssets(product);
  const criticalCss = getLandingCriticalCss(product);
  const deferredStylesheetLoader = `
(() => {
  const applyDeferredStyles = () => {
    document.querySelectorAll('link[data-cw-deferred-style="1"]').forEach((node) => {
      if (!(node instanceof HTMLLinkElement) || node.dataset.cwStyleApplied === "1") {
        return;
      }
      node.rel = "stylesheet";
      node.removeAttribute("as");
      node.dataset.cwStyleApplied = "1";
    });
  };

  if (document.readyState === "complete") {
    requestAnimationFrame(applyDeferredStyles);
    return;
  }

  requestAnimationFrame(applyDeferredStyles);
  window.addEventListener("load", () => {
    requestAnimationFrame(applyDeferredStyles);
  }, { once: true });
})();
`;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: criticalCss }} />
      <script dangerouslySetInnerHTML={{ __html: deferredStylesheetLoader }} />
      {config.styles.map((href) => (
        <link key={href} rel="preload" as="style" href={href} data-cw-deferred-style="1" />
      ))}
      <noscript>
        {config.styles.map((href) => (
          <link key={`noscript-${href}`} rel="stylesheet" href={href} />
        ))}
      </noscript>
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
        data-cw-page={getLandingPublicRouteName(product)}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />
    </>
  );
}
