"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

type GoogleTagProviderProps = {
  measurementId?: string;
};

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag?: (...args: unknown[]) => void;
    __cwGoogleTagInitialized?: boolean;
  }
}

export function GoogleTagProvider({ measurementId }: GoogleTagProviderProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryString = searchParams.toString();

  useEffect(() => {
    if (!measurementId || typeof window === "undefined") return;

    window.dataLayer = window.dataLayer || [];
    window.gtag =
      window.gtag ||
      function gtag(...args: unknown[]) {
        window.dataLayer.push(args);
      };

    if (!window.__cwGoogleTagInitialized) {
      window.gtag("js", new Date());
      window.gtag("config", measurementId, { send_page_view: false });
      window.__cwGoogleTagInitialized = true;
    }

    const pagePath = queryString ? `${pathname}?${queryString}` : pathname;
    window.gtag("event", "page_view", {
      page_location: window.location.href,
      page_path: pagePath,
      page_title: document.title,
      send_to: measurementId,
    });
  }, [measurementId, pathname, queryString]);

  if (!measurementId) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" />
      <Script id="cw-google-tag" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];`}
      </Script>
    </>
  );
}
