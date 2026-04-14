"use client";

import { useCallback, useMemo } from "react";
import type { GeneratorAnalyticsContext } from "@/lib/generator/renderContext";

type CtaEventName = "ConsultCTA" | "DetoxCTA";

type BasePayload = {
  event_name: CtaEventName | "ViewContent" | "ScrollDepth50" | string;
  event_id: string;
  page_url: string;
  fbclid?: string;
  fbp?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  session_id: string;
  product?: string;
  content_name?: string;
  content_type?: string;
  content_ids?: string[];
  cta_place?: string;
  target?: string;
  depth_percent?: number;
  experiment_key?: string;
  variant_key?: string;
  manifest_id?: string;
  manifest_version?: string;
  recipe_version?: string;
  mode?: string;
  branch?: string;
  assignment_source?: "bucket" | "override" | "cookie" | "default";
};

type UseLandingAnalyticsOptions = {
  product: "consult" | "detox" | "herbs";
  contentName: string;
  generatorContext?: GeneratorAnalyticsContext;
};

declare global {
  interface Window {
    CW_API_BASE?: string;
    fbq?: (...args: unknown[]) => void;
  }
}

const ATTRIB_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "cr", "lv"];

function makeEventId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function readCookie(name: string): string {
  const match = document.cookie.match(new RegExp(`(^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : "";
}

function getSessionId(): string {
  try {
    const key = "cw_session_id";
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const generated = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(key, generated);
    return generated;
  } catch {
    return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

function collectAttrib(): Record<string, string> {
  const qs = new URLSearchParams(window.location.search);
  let stored: Record<string, string> = {};

  try {
    stored = JSON.parse(localStorage.getItem("cw_attrib") || "{}");
  } catch {
    stored = {};
  }

  const out: Record<string, string> = {};

  for (const key of ATTRIB_KEYS) {
    const direct = qs.get(key);
    if (direct) out[key] = direct;
    else if (stored[key]) out[key] = stored[key];
  }

  out.referrer = document.referrer || "";
  out.page_url = window.location.href;
  out.user_agent = navigator.userAgent || "";
  out.fbp = readCookie("_fbp");

  return out;
}

function persistAttrib(): void {
  const qs = new URLSearchParams(window.location.search);
  const data: Record<string, string> = {};

  for (const key of ATTRIB_KEYS) {
    const value = qs.get(key);
    if (value) data[key] = value;
  }

  if (Object.keys(data).length > 0) {
    try {
      localStorage.setItem("cw_attrib", JSON.stringify(data));
    } catch {
      // no-op
    }
  }
}

function sendEvent(payload: BasePayload): void {
  const apiBase = window.CW_API_BASE || window.location.origin;
  const endpoint = `${apiBase}/api/events`;

  try {
    if (navigator.sendBeacon) {
      const body = JSON.stringify(payload);
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(endpoint, blob)) return;
    }

    void fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      keepalive: true,
      body: JSON.stringify(payload),
    });
  } catch {
    // no-op
  }
}

export function useLandingAnalytics({ product, contentName, generatorContext }: UseLandingAnalyticsOptions) {
  const sessionId = useMemo(() => getSessionId(), []);

  const trackViewContentOnce = useCallback(() => {
    const sentKey = `cw_viewcontent_sent::${window.location.pathname}`;

    try {
      if (sessionStorage.getItem(sentKey) === "1") return;
    } catch {
      // no-op
    }

    const attrib = collectAttrib();
    const eventId = makeEventId(`viewcontent_${product}`);

    if (typeof window.fbq === "function") {
      window.fbq(
        "track",
        "ViewContent",
        {
          content_name: contentName,
          content_type: "service",
          content_ids: [product],
        },
        { eventID: eventId }
      );
    }

    sendEvent({
      event_name: "ViewContent",
      event_id: eventId,
      page_url: attrib.page_url,
      fbclid: attrib.fbclid,
      fbp: attrib.fbp,
      utm_source: attrib.utm_source,
      utm_medium: attrib.utm_medium,
      utm_campaign: attrib.utm_campaign,
      utm_content: attrib.utm_content,
      utm_term: attrib.utm_term,
      session_id: sessionId,
      product,
      content_name: contentName,
      content_type: "service",
      content_ids: [product],
      experiment_key: generatorContext?.experiment_key,
      variant_key: generatorContext?.variant_key,
      manifest_id: generatorContext?.manifest_id,
      manifest_version: generatorContext?.manifest_version,
      recipe_version: generatorContext?.recipe_version,
      mode: generatorContext?.mode,
      branch: generatorContext?.branch,
      assignment_source: generatorContext?.assignment_source,
    });

    try {
      sessionStorage.setItem(sentKey, "1");
    } catch {
      // no-op
    }
  }, [contentName, generatorContext, product, sessionId]);

  const trackCtaClick = useCallback(
    (opts: { ctaEventName: CtaEventName; ctaPlace: string; href: string }) => {
      const attrib = collectAttrib();
      const eventId = makeEventId(opts.ctaEventName === "ConsultCTA" ? "consult_cta" : "detox_cta");

      if (typeof window.fbq === "function") {
        window.fbq(
          "track",
          "Lead",
          {
            content_name: contentName,
            product,
            cta_place: opts.ctaPlace,
          },
          { eventID: eventId }
        );
      }

      sendEvent({
        event_name: opts.ctaEventName,
        event_id: eventId,
        page_url: attrib.page_url,
        fbclid: attrib.fbclid,
        fbp: attrib.fbp,
        utm_source: attrib.utm_source,
        utm_medium: attrib.utm_medium,
        utm_campaign: attrib.utm_campaign,
        utm_content: attrib.utm_content,
        utm_term: attrib.utm_term,
        session_id: sessionId,
        product,
        cta_place: opts.ctaPlace,
        target: opts.href,
        experiment_key: generatorContext?.experiment_key,
        variant_key: generatorContext?.variant_key,
        manifest_id: generatorContext?.manifest_id,
        manifest_version: generatorContext?.manifest_version,
        recipe_version: generatorContext?.recipe_version,
        mode: generatorContext?.mode,
        branch: generatorContext?.branch,
        assignment_source: generatorContext?.assignment_source,
      });
    },
    [contentName, generatorContext, product, sessionId]
  );

  const trackScrollDepth50 = useCallback(() => {
    const sentKey = `cw_scroll50_sent::${window.location.pathname}`;

    try {
      if (sessionStorage.getItem(sentKey) === "1") return;
    } catch {
      // no-op
    }

    const attrib = collectAttrib();

    sendEvent({
      event_name: "ScrollDepth50",
      event_id: makeEventId(`scroll50_${product}`),
      page_url: attrib.page_url,
      fbclid: attrib.fbclid,
      fbp: attrib.fbp,
      utm_source: attrib.utm_source,
      utm_medium: attrib.utm_medium,
      utm_campaign: attrib.utm_campaign,
      utm_content: attrib.utm_content,
      utm_term: attrib.utm_term,
      session_id: sessionId,
      depth_percent: 50,
      product,
      experiment_key: generatorContext?.experiment_key,
      variant_key: generatorContext?.variant_key,
      manifest_id: generatorContext?.manifest_id,
      manifest_version: generatorContext?.manifest_version,
      recipe_version: generatorContext?.recipe_version,
      mode: generatorContext?.mode,
      branch: generatorContext?.branch,
      assignment_source: generatorContext?.assignment_source,
    });

    try {
      sessionStorage.setItem(sentKey, "1");
    } catch {
      // no-op
    }
  }, [generatorContext, product, sessionId]);

  return {
    persistAttrib,
    trackViewContentOnce,
    trackCtaClick,
    trackScrollDepth50,
  };
}
