"use client";

import { useLayoutEffect, useState } from "react";

export type HeaderTone = "light" | "dark";

function parseCssColor(value: string) {
  const normalized = value.trim().toLowerCase();

  if (normalized.startsWith("rgb")) {
    const parts = normalized.match(/[\d.]+/g);
    if (!parts || parts.length < 3) return null;
    return {
      r: Number(parts[0]),
      g: Number(parts[1]),
      b: Number(parts[2]),
      a: parts[3] ? Number(parts[3]) : 1,
    };
  }

  if (normalized.startsWith("#")) {
    const hex = normalized.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      return {
        r: parseInt(hex[0] + hex[0], 16),
        g: parseInt(hex[1] + hex[1], 16),
        b: parseInt(hex[2] + hex[2], 16),
        a: hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1,
      };
    }

    if (hex.length === 6 || hex.length === 8) {
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
      };
    }
  }

  return null;
}

function luminanceFromColor(color: { r: number; g: number; b: number }) {
  const channels = [color.r, color.g, color.b].map((value) => {
    const channel = value / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function resolveExplicitTopbarTone(sampleY: number): HeaderTone | null {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>("[data-cw-topbar-tone]"));

  for (const candidate of candidates) {
    const tone = candidate.dataset.cwTopbarTone;
    if (tone !== "light" && tone !== "dark") continue;

    const rect = candidate.getBoundingClientRect();
    if (rect.bottom <= 0 || rect.top >= window.innerHeight) continue;
    if (rect.top <= sampleY && rect.bottom >= sampleY) return tone;
  }

  return null;
}

function resolveToneFromPoint(x: number, y: number): HeaderTone | null {
  const elements = document.elementsFromPoint(x, y);

  for (const node of elements) {
    if (!(node instanceof HTMLElement)) continue;
    if (node.closest("header[data-cw-header-tone]")) continue;

    const explicitTone = node.closest<HTMLElement>("[data-cw-topbar-tone]")?.dataset.cwTopbarTone;
    if (explicitTone === "light" || explicitTone === "dark") return explicitTone;

    let current: HTMLElement | null = node;

    while (current && current !== document.body) {
      const style = window.getComputedStyle(current);
      const backgroundImage = style.backgroundImage;
      const parsed = parseCssColor(style.backgroundColor);

      if (parsed && parsed.a > 0.08) {
        return luminanceFromColor(parsed) < 0.34 ? "dark" : "light";
      }

      if (backgroundImage && backgroundImage !== "none") {
        return "dark";
      }

      current = current.parentElement;
    }
  }

  return null;
}

export function useHeaderTone(initialTone: HeaderTone = "light", watchKey?: string | null) {
  const [headerTone, setHeaderTone] = useState<HeaderTone>(initialTone);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    let frame = 0;
    let followupFrame = 0;
    let settleTimer = 0;

    const updateTone = () => {
      frame = 0;
      const header = document.querySelector<HTMLElement>("header[data-cw-header-tone]");
      const headerHeight = header?.offsetHeight ?? 72;
      const sampleY = Math.max(16, Math.min(window.innerHeight - 16, Math.round(headerHeight * 0.72)));
      const explicitTone = resolveExplicitTopbarTone(sampleY);

      if (explicitTone) {
        setHeaderTone(explicitTone);
        return;
      }

      const samplePoints = [0.18, 0.5, 0.82].map((ratio) => Math.round(window.innerWidth * ratio));
      const tones = samplePoints
        .map((sampleX) => resolveToneFromPoint(sampleX, sampleY))
        .filter((tone): tone is HeaderTone => tone === "light" || tone === "dark");

      if (!tones.length) return;

      const darkVotes = tones.filter((tone) => tone === "dark").length;
      setHeaderTone(darkVotes >= Math.ceil(tones.length / 2) ? "dark" : "light");
    };

    const requestToneUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateTone);
    };

    updateTone();
    requestToneUpdate();
    followupFrame = window.requestAnimationFrame(() => {
      updateTone();
      settleTimer = window.setTimeout(updateTone, 120);
    });

    const mutationObserver = new MutationObserver(requestToneUpdate);
    mutationObserver.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-cw-topbar-tone", "style", "class"],
    });

    window.addEventListener("scroll", requestToneUpdate, { passive: true });
    window.addEventListener("resize", requestToneUpdate);
    window.addEventListener("load", requestToneUpdate);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      if (followupFrame) window.cancelAnimationFrame(followupFrame);
      if (settleTimer) window.clearTimeout(settleTimer);
      mutationObserver.disconnect();
      window.removeEventListener("scroll", requestToneUpdate);
      window.removeEventListener("resize", requestToneUpdate);
      window.removeEventListener("load", requestToneUpdate);
    };
  }, [initialTone, watchKey]);

  return headerTone;
}
