"use client";

import { useEffect } from "react";

type CtaTrackConfig = {
  ctaClass: string;
  ctaEventName: "ConsultCTA" | "DetoxCTA";
  track: (opts: { ctaEventName: "ConsultCTA" | "DetoxCTA"; ctaPlace: string; href: string }) => void;
};

export function useCtaTracking(config: CtaTrackConfig) {
  const { ctaClass, ctaEventName, track } = config;

  useEffect(() => {
    const ctas = Array.from(document.querySelectorAll<HTMLAnchorElement>(`.${ctaClass}`));

    const removers = ctas.map((cta) => {
      const onClick = () => {
        const ctaPlace = cta.getAttribute("data-cta-place") || "unknown";
        const href = cta.getAttribute("href") || "";
        track({
          ctaEventName,
          ctaPlace,
          href,
        });
      };

      cta.addEventListener("click", onClick);
      return () => cta.removeEventListener("click", onClick);
    });

    return () => {
      removers.forEach((remove) => remove());
    };
  }, [ctaClass, ctaEventName, track]);
}
