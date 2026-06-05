import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { GoogleTagProvider } from "@/lib/tracking/GoogleTagProvider";
import { Suspense } from "react";

const GOOGLE_TAG_ID = "G-HV89HDP52T";

export const metadata: Metadata = {
  title: "CenterWay Funnels",
  description: "Isolated landing runtime for CenterWay funnels",
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
