import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { GoogleTagProvider } from "@/lib/tracking/GoogleTagProvider";
import { Suspense } from "react";
import { PLATFORM_GROUND } from "@/lib/platform/chrome";
import { BRAND } from "@/lib/brand/identity";

const GOOGLE_TAG_ID = "G-HV89HDP52T";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.centerway.net.ua"),
  /* The FALLBACK only — every landing writes its own title and description in
     `getLandingMetadata`. It was "CenterWay Funnels" / "Isolated landing
     runtime for CenterWay funnels": the internal name of the runtime, in
     English, one missing landing away from being a public title.

     No template here, unlike the platform layout. A funnel host is deliberately
     its own surface (see the isolation rule in the brand contract), and hanging
     "— CenterWay" onto every landing title would be exactly the cross-brand
     link that rule forbids. */
  title: BRAND.name,
  description: BRAND.description,
  openGraph: {
    type: "website",
    siteName: "CenterWay",
    images: [{ url: "/cw/brand/cw-og-cover.png", width: 1200, height: 630, alt: "CenterWay" }],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/cw/brand/cw-og-cover.png"],
  },
};


export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: PLATFORM_GROUND,
};

export default function FunnelsRootLayout({
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
        {children}
        <Analytics />
      </body>
    </html>
  );
}
