import type { Metadata, Viewport } from "next";

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
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
