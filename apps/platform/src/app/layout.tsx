import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CenterWay Platform",
  description: "Unified platform for CenterWay products",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
