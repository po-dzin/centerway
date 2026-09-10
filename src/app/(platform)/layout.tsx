import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { GoogleTagProvider } from "@/components/tracking/GoogleTagProvider";
import { PixelProvider } from "@/components/tracking/PixelProvider";
import { Suspense } from "react";
import { preload } from "react-dom";
import { RouteMotion } from "@/components/platform/RouteMotion";
import { BfcacheRestore } from "@/components/platform/BfcacheRestore";
import { ToastProvider } from "@/components/ToastProvider";
import { SessionProvider } from "@/components/auth/SessionProvider";
import "../globals.css";
import { PLATFORM_GROUND } from "@/lib/platform/chrome";
import { THEME_BOOT_SCRIPT } from "@/lib/platform/theme";
import { BRAND, BRAND_COVER, BRAND_LOCALE } from "@/lib/brand/identity";
import { JsonLd } from "@/components/seo/StructuredData";
import { graph, organizationLd, personLd, websiteLd } from "@/lib/seo/jsonLd";
import { PLATFORM_ORIGIN } from "@/lib/surfaces/catalog";

const GOOGLE_TAG_ID = "G-HV89HDP52T";

export const metadata: Metadata = {
  // Needed for the OG/Twitter image below: Next resolves relative asset paths
  // against this, and a scraper is handed an absolute URL or nothing.
  metadataBase: new URL(PLATFORM_ORIGIN),
  title: {
    // The suffix a page no longer writes by hand. It used to be typed into
    // every title — as "- CenterWay", "| CenterWay", "CenterWay |", or not at
    // all — which is four brands as far as a result page is concerned.
    default: `${BRAND.name} — ${BRAND.category}`,
    template: `%s — ${BRAND.name}`,
  },
  // Was "Unified platform for CenterWay products": English, internal, and the
  // fallback description for every page that forgot its own.
  description: BRAND.description,
  applicationName: BRAND.name,
  keywords: [...BRAND.entities],
  authors: [{ name: BRAND.founder.name, url: `${PLATFORM_ORIGIN}${BRAND.founder.path}` }],
  creator: BRAND.founder.name,
  publisher: BRAND.name,
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    locale: BRAND_LOCALE,
    url: `${PLATFORM_ORIGIN}/`,
    images: [{ url: BRAND_COVER, width: 1200, height: 630, alt: BRAND.name }],
  },
  twitter: {
    card: "summary_large_image",
    images: [BRAND_COVER],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: PLATFORM_GROUND,
};

/**
 * STATIC BY DEFAULT, since 2026-09-10. This layout used to read the Host header
 * so the client tree could resolve links across `www` and `my`, and that one
 * `headers()` call made every page under it dynamic — the whole showcase
 * rendered per request for one string. The shell now provides the host from
 * the page's own `surface` declaration (see components/platform/layout/
 * SurfaceHost.tsx), so a page here is as static as its own data allows.
 *
 * The data behind the showcase is tag-cached and purged on write, and a tag
 * purge also drops the routes that read it. `revalidate` below is the safety
 * net under that: nothing here is ever more than an hour stale even if a
 * write path forgets its tag.
 */
export const revalidate = 3600;

/**
 * The faces the first paint needs, told to the browser before the stylesheet
 * asks. The `@font-face` rules sit inside globals.css, so without this the
 * fetch starts only after the CSS has parsed and the text has laid out — and
 * with `font-display: swap` that is a visible re-render of every heading.
 *
 * Both families are variable fonts, one file per subset, so this is four
 * files (104 KB): the Cyrillic and Latin subsets of the editorial serif and of
 * the UI sans. The mono face and the extended subsets stay lazy.
 */
const FIRST_PAINT_FONTS = [
  "/fonts/platform/co3bmX5slCNuHLi8bLeY9MK7whWMhyjYrXtKky2F7i6C.woff2", // Cormorant Garamond, cyrillic
  "/fonts/platform/co3bmX5slCNuHLi8bLeY9MK7whWMhyjYqXtKky2F7g.woff2", // Cormorant Garamond, latin
  "/fonts/platform/xn7gYHE41ni1AdIRggOxSvfedN62Zw.woff2", // Manrope, cyrillic
  "/fonts/platform/xn7gYHE41ni1AdIRggexSvfedN4.woff2", // Manrope, latin
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  for (const href of FIRST_PAINT_FONTS) {
    preload(href, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  }

  return (
    <html lang="uk" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {/* The theme, stamped before the first frame. It is inline and not a
            module on purpose: a module arrives after the first paint, and the
            reader would watch a cream page turn graphite. See
            src/lib/platform/theme.ts for why one script rather than a
            `prefers-color-scheme` rule in the stylesheet. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
        <Suspense fallback={null}>
          <GoogleTagProvider measurementId={GOOGLE_TAG_ID} />
        </Suspense>
        {/* The Meta Pixel, finally mounted. It had been written and left
            unmounted, so a purchase returning to a platform page had a
            server-side Purchase from the WayForPay webhook and nothing in the
            browser to deduplicate it against. Honours cw_staff — see the
            provider. */}
        <Suspense fallback={null}>
          <PixelProvider />
        </Suspense>
        {/* The brand graph, on every public page of the showcase. It is three
            nodes and ~1 KB, and it is what makes a Course or a Product on any
            other page resolve to a provider instead of a bare name. */}
        <JsonLd data={graph(organizationLd(), websiteLd(), personLd())} />
        {/* Ends a route transition the moment the next route is in the DOM.
            In Suspense because it reads the search string, and renders nothing
            either way — see the component for why it is a listener above the
            tree rather than a wrapper around it. */}
        <Suspense fallback={null}>
          <RouteMotion />
        </Suspense>
        {/* Forces a fresh navigation when Chrome thaws this exact page from
            bfcache after a trip to a funnel landing — see the component for
            why that trip is the one that breaks here. */}
        <BfcacheRestore />
        <SessionProvider><ToastProvider>{children}</ToastProvider></SessionProvider>
        <Analytics />
      </body>
    </html>
  );
}
