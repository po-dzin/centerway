import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { GoogleTagProvider } from "@/lib/tracking/GoogleTagProvider";
import { PixelProvider } from "@/lib/tracking/PixelProvider";
import { Suspense } from "react";
import { headers } from "next/headers";
import { SurfaceHostProvider } from "@/components/platform/layout/SurfaceHost";
import "../globals.css";
import { PLATFORM_GROUND } from "@/lib/platform/chrome";
import { BRAND, BRAND_COVER, BRAND_LOCALE } from "@/lib/brand/identity";
import { JsonLd } from "@/lib/seo/StructuredData";
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
 * The host is read HERE, once, and handed to the client tree.
 *
 * Two origins serve this app — `www` (public) and `my` (personal) — and which
 * one owns a given path is the question every link asks. Answering it from
 * `window` would mean the server renders one `href` and the browser hydrates
 * another; answering it here means the markup is right when it is sent.
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");

  return (
    <html lang="uk" suppressHydrationWarning>
      <body suppressHydrationWarning>
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
        <SurfaceHostProvider host={host}>{children}</SurfaceHostProvider>
        <Analytics />
      </body>
    </html>
  );
}
