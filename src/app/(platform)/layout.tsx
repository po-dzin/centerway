import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { GoogleTagProvider } from "@/lib/tracking/GoogleTagProvider";
import { PixelProvider } from "@/lib/tracking/PixelProvider";
import { Suspense } from "react";
import "../globals.css";
import { PLATFORM_GROUND } from "@/lib/platform/chrome";

const GOOGLE_TAG_ID = "G-HV89HDP52T";

/** Baked by scripts/brand-mark-bake.mjs — the mark and wordmark on the deep ground. */
const BRAND_COVER = "/cw/brand/cw-og-cover.png";

export const metadata: Metadata = {
  // Needed for the OG/Twitter image below: Next resolves relative asset paths
  // against this, and a scraper is handed an absolute URL or nothing.
  metadataBase: new URL("https://www.centerway.net.ua"),
  title: "CenterWay Platform",
  description: "Unified platform for CenterWay products",
  openGraph: {
    type: "website",
    siteName: "CenterWay",
    images: [{ url: BRAND_COVER, width: 1200, height: 630, alt: "CenterWay" }],
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
        {children}
        <Analytics />
      </body>
    </html>
  );
}
