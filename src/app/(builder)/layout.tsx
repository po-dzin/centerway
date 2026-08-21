import type { Metadata, Viewport } from "next";

import "../globals.css";

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
  metadataBase: new URL("https://build.centerway.net.ua"),
  title: "CenterWay Builder",
  description: "Конструктор курсів CenterWay.",
  // Never indexed. Every route behind it is someone's unpublished draft.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function BuilderRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uk" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
