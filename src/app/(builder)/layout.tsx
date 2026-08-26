import { PERSONAL_ORIGIN } from "@/lib/surfaces/catalog";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { SurfaceHostProvider } from "@/components/platform/layout/SurfaceHost";

import "../globals.css";
import { PLATFORM_GROUND } from "@/lib/platform/chrome";

/**
 * The builder's own root.
 *
 * A separate route-group root, like `(funnels)`, because the builder is a
 * separate application on a separate host — and because everything the platform
 * root layout carries is wrong here: analytics and the Google tag measure a
 * marketing funnel, and an authoring tool used by a handful of signed-in people
 * is not one. No tag, no analytics, nothing to consent to.
 *
 * Design tokens are shared. The builder is a CenterWay surface and should look
 * like one; what it does not share is the platform's chrome.
 */
export const metadata: Metadata = {
  metadataBase: new URL(PERSONAL_ORIGIN),
  title: "CenterWay Білдер",
  description: "Конструктор курсів CenterWay.",
  // Never indexed. Every route behind it is someone's unpublished draft.
  robots: { index: false, follow: false },
};


export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: PLATFORM_GROUND,
};

export default async function BuilderRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Same reason as the platform root: links out of the builder cross into the
  // public origin, and the host has to be known where the markup is made.
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");

  return (
    <html lang="uk" suppressHydrationWarning>
      <body suppressHydrationWarning>
        <SurfaceHostProvider host={host}>{children}</SurfaceHostProvider>
      </body>
    </html>
  );
}
