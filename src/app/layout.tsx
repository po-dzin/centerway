import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, IBM_Plex_Mono, Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--cw-font-ui",
});

const cormorant = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--cw-font-editorial",
  weight: ["500", "600", "700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--cw-font-data",
  weight: ["400", "500", "600"],
});

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
    <html lang="en" suppressHydrationWarning>
      <body className={`${manrope.variable} ${cormorant.variable} ${ibmPlexMono.variable}`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
