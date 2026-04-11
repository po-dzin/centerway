"use client";

import { useEffect } from "react";

type StickyConfig = {
  stickyId?: string;
  heroSelector?: string;
  staticCtaSelector?: string;
};

export function useStickyCta(config: StickyConfig = {}) {
  const stickyId = config.stickyId ?? "sticky-cta";
  const heroSelector = config.heroSelector ?? '[data-cta-place="hero"]';
  const staticCtaSelector =
    config.staticCtaSelector ?? '[data-cta-place="pricing"], [data-cta-place="next_step"]';

  useEffect(() => {
    const sticky = document.getElementById(stickyId);
    const heroCta = document.querySelector<HTMLElement>(heroSelector);
    const staticCtas = Array.from(document.querySelectorAll<HTMLElement>(staticCtaSelector));

    if (!sticky || !heroCta) return;

    const shouldShowSticky = () => {
      const heroRect = heroCta.getBoundingClientRect();
      const heroOutOfView = heroRect.bottom <= 0;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
      const anyStaticCtaInView = staticCtas.some((cta) => {
        const rect = cta.getBoundingClientRect();
        return rect.top < viewportHeight && rect.bottom > 0;
      });

      const shouldShow = heroOutOfView && !anyStaticCtaInView;
      sticky.classList.toggle("visible", shouldShow);
      sticky.setAttribute("aria-hidden", shouldShow ? "false" : "true");
    };

    window.addEventListener("scroll", shouldShowSticky, { passive: true });
    window.addEventListener("resize", shouldShowSticky);
    shouldShowSticky();

    return () => {
      window.removeEventListener("scroll", shouldShowSticky);
      window.removeEventListener("resize", shouldShowSticky);
    };
  }, [heroSelector, staticCtaSelector, stickyId]);
}
