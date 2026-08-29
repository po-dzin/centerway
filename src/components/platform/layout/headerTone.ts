"use client";

import { useLayoutEffect, useRef, useState } from "react";

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

/* Photography reads as dark: the heroes are graded down and carry a scrim, and
   there is no cheap way to sample actual pixels. The stand-in sits below
   ENTER_DARK so a photo resolves as dark under either hysteresis branch. */
const PHOTO_LUMINANCE = 0.12;

/* A band that declares itself light, as a value rather than a verdict, so it can
   take part in the open sheet's median alongside measured rows. Above
   ENTER_LIGHT by design. */
const DECLARED_LIGHT_LUMINANCE = 0.9;

/* Two thresholds, not one. With a single switch point at 0.34, any section
   boundary that happened to land near it flipped the bar every few scrolled
   pixels — /tests strobed five times in one pass, two of those 120px apart.
   With a band between the thresholds the bar has to travel past a boundary
   before it changes its mind.

   These two numbers are also load-bearing beyond comfort: ENTER_LIGHT is the
   brightest backdrop a dark bar is ever allowed to sit on, and that is exactly
   the bound guard-contrast checks the dark-tone labels against (#8a8a8a,
   luminance 0.26). Raise ENTER_LIGHT and the assertion in that file stops being
   true — the pair and this constant move together or not at all. The band is
   narrower than it was because the two tones are no longer far apart: at a 30%
   tint the flip is a change of text colour over the same see-through glass, not
   a plate inverting, so switching more readily costs almost nothing visually. */
const ENTER_DARK = 0.18;
const ENTER_LIGHT = 0.26;

type PointReading = { tone: HeaderTone } | { luminance: number } | null;

function resolveReadingFromPoint(x: number, y: number): PointReading {
  const elements = document.elementsFromPoint(x, y);

  for (const node of elements) {
    if (!(node instanceof HTMLElement)) continue;
    if (node.closest("header[data-cw-header-tone]")) continue;

    const explicitTone = node.closest<HTMLElement>("[data-cw-topbar-tone]")?.dataset.cwTopbarTone;
    if (explicitTone === "light" || explicitTone === "dark") return { tone: explicitTone };

    let current: HTMLElement | null = node;

    while (current && current !== document.body) {
      const style = window.getComputedStyle(current);
      const backgroundImage = style.backgroundImage;
      const parsed = parseCssColor(style.backgroundColor);

      if (parsed && parsed.a > 0.08) {
        return { luminance: luminanceFromColor(parsed) };
      }

      if (backgroundImage && backgroundImage !== "none") {
        return { luminance: PHOTO_LUMINANCE };
      }

      current = current.parentElement;
    }
  }

  return null;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export function useHeaderTone(
  initialTone: HeaderTone = "light",
  watchKey?: string | null,
  frozen = false,
) {
  const [headerTone, setHeaderTone] = useState<HeaderTone>(initialTone);
  // Hysteresis has to compare against the tone that is on screen right now, not
  // the one this render closed over.
  const toneRef = useRef<HeaderTone>(initialTone);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    // The open mobile menu is the expanded state of the current glass bar, not
    // a new surface. Background scrolling is locked while it is open, so keep
    // the already resolved tone until the sheet closes and sampling resumes.
    if (frozen) return;

    /* Hysteresis fixes the sampled path, but most flips are not sampled — the
       sections declare their own tone, and some of them are short. On / the bar
       was asked to go dark at 1280 and light again at 1320: a 40px band passing
       under the sample line. So a declared change also has to hold still before
       it counts. At a flick's speed a band that thin is gone inside the dwell
       and never reaches the bar; a real boundary takes longer than this to
       cross and commits normally. */
    const DWELL_MS = 160;

    let pendingTone: HeaderTone | null = null;
    let pendingTimer = 0;
    // Mount runs updateTone several times as layout settles; those must land
    // immediately or the bar starts on the wrong tone.
    let immediate = true;

    const applyTone = (tone: HeaderTone) => {
      pendingTone = null;
      toneRef.current = tone;
      setHeaderTone(tone);
    };

    const commitTone = (tone: HeaderTone) => {
      if (toneRef.current === tone) {
        pendingTone = null;
        if (pendingTimer) {
          window.clearTimeout(pendingTimer);
          pendingTimer = 0;
        }
        return;
      }

      if (immediate) {
        applyTone(tone);
        return;
      }

      if (pendingTone === tone && pendingTimer) return;
      if (pendingTimer) window.clearTimeout(pendingTimer);
      pendingTone = tone;
      pendingTimer = window.setTimeout(() => {
        pendingTimer = 0;
        if (pendingTone) applyTone(pendingTone);
      }, DWELL_MS);
    };

    let frame = 0;
    let followupFrame = 0;
    let settleTimer = 0;

    const updateTone = () => {
      frame = 0;
      const headerEl = document.querySelector<HTMLElement>("header[data-cw-header-tone]");
      const headerHeight = headerEl?.offsetHeight ?? 72;
      const sampleY = Math.max(16, Math.min(window.innerHeight - 16, Math.round(headerHeight * 0.72)));

      /* The open sheet is 320px of backdrop, not the bar's 64px, so it is
         sampled down its own height and the tone follows what the sheet actually
         covers. Freezing the tone while open was the previous behaviour and it
         was worse in the way that shows: scroll under an open menu and the sheet
         stayed on the tone it was opened with, then snapped to the real one the
         moment you closed it — the change happened where you were not looking.

         Note what is *not* being re-decided here: density. The sheet keeps the
         media floor in both tones. An earlier attempt let the rows decide
         thickness too, and about half of all scroll positions came back mixed
         (bright band, dark object, one sheet), so the same menu opened
         see-through or frosted depending on where you happened to be. Tone has
         no such problem — the sheet is legible either way at the media floor, so
         the flip is a palette change and nothing else, carried by the same dwell
         and cross-fade as the bar's own. */
      const menuOpen = headerEl?.dataset.menuOpen === "true";
      const sheetHeight = menuOpen && headerEl
        ? Number.parseFloat(headerEl.style.getPropertyValue("--cw-menu-sheet-height")) || 0
        : 0;

      /* A declared band is trusted for the bar, whose whole box it covers. It is
         not trusted for the sheet, which reaches far below that band. */
      const explicitTone = menuOpen ? null : resolveExplicitTopbarTone(sampleY);

      if (explicitTone) {
        commitTone(explicitTone);
        return;
      }

      const samplePoints = [0.18, 0.5, 0.82].map((ratio) => Math.round(window.innerWidth * ratio));
      const sampleRows = sheetHeight > 0
        ? [sampleY, ...[0.3, 0.6, 0.92].map((ratio) => Math.round(headerHeight + sheetHeight * ratio))]
            .filter((y) => y < window.innerHeight - 4)
        : [sampleY];

      const readings = sampleRows
        .flatMap((rowY) => samplePoints.map((sampleX) => resolveReadingFromPoint(sampleX, rowY)))
        .filter((reading): reading is Exclude<PointReading, null> => reading !== null);

      if (!readings.length) return;

      // A declared tone under a sample column is the author stating what that
      // band is, and for the bar it wins outright — it is not a measurement that
      // could be sitting on a threshold, so it needs no hysteresis. For the sheet
      // it must not short-circuit, or one band would decide for rows it does not
      // cover; there it folds into the readings as a value.
      if (!menuOpen) {
        const declared = readings.find((reading): reading is { tone: HeaderTone } => "tone" in reading);
        if (declared) {
          commitTone(declared.tone);
          return;
        }
      }

      const luminances = readings.map((reading) =>
        "tone" in reading
          ? reading.tone === "dark" ? PHOTO_LUMINANCE : DECLARED_LIGHT_LUMINANCE
          : reading.luminance,
      );

      /* Median in both cases, and for the same reason: the surface should match
         what it mostly sits on, and one odd column or one dark object should not
         speak for the whole thing. The bar reads three columns of its own 64px;
         the sheet reads the same three across four rows of its own height. */
      const level = median(luminances);
      const current = toneRef.current;
      commitTone(
        current === "dark"
          ? level > ENTER_LIGHT ? "light" : "dark"
          : level < ENTER_DARK ? "dark" : "light",
      );
    };

    const requestToneUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateTone);
    };

    updateTone();
    requestToneUpdate();
    followupFrame = window.requestAnimationFrame(() => {
      updateTone();
      settleTimer = window.setTimeout(() => {
        updateTone();
        immediate = false;
      }, 120);
    });

    const mutationObserver = new MutationObserver(requestToneUpdate);
    mutationObserver.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-cw-topbar-tone", "style", "class"],
    });

    /* A THEME CHANGE IS A CHANGE TO WHAT THE BAR FLOATS OVER, and it is the one
       such change the observer above cannot see: the theme is stamped on
       <html>, and `document.body` with `subtree` covers body's descendants, not
       body's parent. So switching light/dark repainted the whole page and moved
       nothing this effect was watching — the bar kept the tone it had measured
       under the previous palette, and a graphite topbar and account menu stayed
       standing on a freshly lit page until the next scroll or resize happened
       to re-sample. That is what "the dark theme crawled onto the light one"
       was: not two themes, one stale measurement.

       Watching the attribute rather than subscribing to the theme store is
       deliberate — it catches every writer by construction, including the OS
       flipping under a `system` choice, which repaints the document through
       `applyPlatformTheme` without dispatching the store's event. */
    const themeObserver = new MutationObserver(requestToneUpdate);
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-cw-theme"],
    });

    window.addEventListener("scroll", requestToneUpdate, { passive: true });
    window.addEventListener("resize", requestToneUpdate);
    window.addEventListener("load", requestToneUpdate);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      if (followupFrame) window.cancelAnimationFrame(followupFrame);
      if (settleTimer) window.clearTimeout(settleTimer);
      if (pendingTimer) window.clearTimeout(pendingTimer);
      mutationObserver.disconnect();
      themeObserver.disconnect();
      window.removeEventListener("scroll", requestToneUpdate);
      window.removeEventListener("resize", requestToneUpdate);
      window.removeEventListener("load", requestToneUpdate);
    };
  }, [frozen, initialTone, watchKey]);

  return headerTone;
}
