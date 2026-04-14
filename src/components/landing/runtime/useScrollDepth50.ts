"use client";

import { useEffect } from "react";

export function useScrollDepth50(trackScrollDepth50: () => void) {
  useEffect(() => {
    let sent = false;
    const sentKey = `cw_scroll50_sent::${window.location.pathname}`;

    try {
      if (sessionStorage.getItem(sentKey) === "1") {
        sent = true;
      }
    } catch {
      // no-op
    }

    const maybeSend = () => {
      if (sent) return;

      const doc = document.documentElement;
      const body = document.body;
      const scrollTop = window.scrollY || doc.scrollTop || 0;
      const viewportHeight = window.innerHeight || doc.clientHeight || 0;
      const totalHeight = Math.max(
        doc.scrollHeight || 0,
        body ? body.scrollHeight : 0,
        doc.offsetHeight || 0,
        body ? body.offsetHeight : 0
      );

      if (!totalHeight) return;

      const progress = ((scrollTop + viewportHeight) / totalHeight) * 100;
      if (progress < 50) return;

      sent = true;
      trackScrollDepth50();
      window.removeEventListener("scroll", maybeSend);
      window.removeEventListener("resize", maybeSend);
    };

    window.addEventListener("scroll", maybeSend, { passive: true });
    window.addEventListener("resize", maybeSend);
    const timeout = window.setTimeout(maybeSend, 350);

    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("scroll", maybeSend);
      window.removeEventListener("resize", maybeSend);
    };
  }, [trackScrollDepth50]);
}
