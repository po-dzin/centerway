"use client";

import { useEffect } from "react";
import type { GeneratorAnalyticsContext } from "@/lib/generator/renderContext";
import { formatPrice } from "./formatPrice";
import { useCtaTracking } from "./useCtaTracking";
import { useLandingAnalytics } from "./useLandingAnalytics";
import { useRevealOnIntersect } from "./useRevealOnIntersect";
import { useScrollDepth50 } from "./useScrollDepth50";
import { useStickyCta } from "./useStickyCta";

type LandingRuntimeConfig = {
  product: "consult" | "detox" | "herbs";
  contentName: string;
  ctaClass: string;
  ctaEventName: "ConsultCTA" | "DetoxCTA";
  generatorContext?: GeneratorAnalyticsContext;
};

export function useLandingRuntime(config: LandingRuntimeConfig) {
  const analytics = useLandingAnalytics({
    product: config.product,
    contentName: config.contentName,
    generatorContext: config.generatorContext,
  });
  const { persistAttrib, trackViewContentOnce, trackScrollDepth50, trackCtaClick } = analytics;

  useEffect(() => {
    persistAttrib();
    formatPrice();
    trackViewContentOnce();
  }, [persistAttrib, trackViewContentOnce]);

  useScrollDepth50(trackScrollDepth50);
  useCtaTracking({
    ctaClass: config.ctaClass,
    ctaEventName: config.ctaEventName,
    track: trackCtaClick,
  });
  useStickyCta();
  useRevealOnIntersect();

  return analytics;
}
