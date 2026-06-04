import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import "../globals.css";

export const metadata: Metadata = {
  title: "CenterWay Platform",
  description: "Unified platform for CenterWay products",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
