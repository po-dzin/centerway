import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { GoogleTagProvider } from "@/lib/tracking/GoogleTagProvider";
import { Suspense } from "react";

const GOOGLE_TAG_ID = "G-HV89HDP52T";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.centerway.net.ua"),
  title: "CenterWay Funnels",
  description: "Isolated landing runtime for CenterWay funnels",
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
