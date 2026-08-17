/**
 * Bake core shared by the CLI (scripts/icons-bake.mjs) and the Design System
 * preview generator (scripts/icons-preview.mjs). See the CLI header for why
 * the wobble is baked geometrically rather than left as a runtime filter.
 */

import { chromium } from "@playwright/test";
import {
  ICONS,
  GRAPHICS,
  ICON_VIEWBOX,
  GRAPHIC_VIEWBOX,
  HAND_PRESETS,
} from "./icon-glyphs.mjs";

export const STROKE_WIDTH = { icon: 1.5, graphic: 1.5 };

/** Sampling step in user units — fine enough that a 24-grid curve stays smooth. */
export const SAMPLE_STEP = 0.7;

function bakeInPage(job) {
  const { items, preset } = job;

  // ── seeded 2D value noise, smoothstep-interpolated ────────────────────────
  const hash = (x, y, seed) => {
    let h = x * 374761393 + y * 668265263 + seed * 2147483647;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const smooth = (t) => t * t * (3 - 2 * t);
  const noise = (x, y, seed) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const tx = smooth(x - xi);
    const ty = smooth(y - yi);
    const a = hash(xi, yi, seed);
    const b = hash(xi + 1, yi, seed);
    const c = hash(xi, yi + 1, seed);
    const d = hash(xi + 1, yi + 1, seed);
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  };

  // feTurbulence baseFrequency is cycles per user unit -> noise cell size.
  // fractalNoise sums `octaves` of it (lacunarity 2, persistence .5); without
  // the second octave a 24-grid glyph gets a near-uniform nudge instead of a
  // living contour, which is exactly what the approved study looked like.
  const period = preset.frequency > 0 ? 1 / preset.frequency : 0;
  const octaves = preset.octaves ?? 2;
  const fractal = (x, y, seed) => {
    let sum = 0;
    let amp = 1;
    let norm = 0;
    for (let o = 0; o < octaves; o += 1) {
      const f = 2 ** o;
      sum += (noise(x * f, y * f, seed + o * 37) - 0.5) * amp;
      norm += amp;
      amp *= 0.5;
    }
    return 0.5 + sum / norm;
  };
  const displace = (pt) => {
    if (!period || !preset.scale) return pt;
    const nx = fractal(pt.x / period, pt.y / period, preset.seed);
    const ny = fractal(pt.x / period, pt.y / period, preset.seed + 101);
    // feDisplacementMap maps channel 0..1 to -scale/2..+scale/2.
    return {
      x: pt.x + (nx - 0.5) * preset.scale,
      y: pt.y + (ny - 0.5) * preset.scale,
    };
  };

  const round = (n) => Math.round(n * 100) / 100;

  /** Catmull-Rom through the samples -> cubic Beziers, so the wobble stays soft. */
  const toPathData = (pts, closed) => {
    if (pts.length < 2) return "";
    const p = closed ? [pts[pts.length - 1], ...pts, pts[0], pts[1]] : [pts[0], ...pts, pts[pts.length - 1]];
    let d = `M${round(pts[0].x)} ${round(pts[0].y)}`;
    for (let i = 1; i < p.length - 2; i += 1) {
      const p0 = p[i - 1];
      const p1 = p[i];
      const p2 = p[i + 1];
      const p3 = p[i + 2];
      const c1x = p1.x + (p2.x - p0.x) / 6;
      const c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6;
      const c2y = p2.y - (p3.y - p1.y) / 6;
      d += `C${round(c1x)} ${round(c1y)} ${round(c2x)} ${round(c2y)} ${round(p2.x)} ${round(p2.y)}`;
    }
    return closed ? `${d}Z` : d;
  };

  const svgNS = "http://www.w3.org/2000/svg";
  const host = document.createElementNS(svgNS, "svg");
  host.setAttribute("width", "0");
  host.setAttribute("height", "0");
  document.body.appendChild(host);

  const probe = document.createElementNS(svgNS, "path");
  host.appendChild(probe);

  /** Resample one path's data, displaced. Subpaths are split on M commands. */
  const bakePath = (data) => {
    const subpaths = data
      .split(/(?=[Mm])/)
      .map((s) => s.trim())
      .filter(Boolean);
    const out = [];
    for (const sub of subpaths) {
      const closed = /[Zz]\s*$/.test(sub);
      probe.setAttribute("d", sub);
      const total = probe.getTotalLength();
      if (!total) continue;
      const steps = Math.max(2, Math.ceil(total / job.sampleStep));
      const pts = [];
      const count = closed ? steps : steps + 1;
      for (let i = 0; i < count; i += 1) {
        const at = (total * (closed ? i / steps : i / steps));
        pts.push(displace(probe.getPointAtLength(Math.min(at, total))));
      }
      out.push(toPathData(pts, closed));
    }
    return out.filter(Boolean);
  };

  /** A ring (stroked circle) gets the same treatment; filled dots do not. */
  const circleToPath = (cx, cy, r) =>
    `M${cx} ${cy - r}A${r} ${r} 0 1 0 ${cx} ${cy + r}A${r} ${r} 0 1 0 ${cx} ${cy - r}Z`;

  const result = {};
  for (const item of items) {
    const paths = [];
    for (const entry of item.d ?? []) {
      const data = typeof entry === "string" ? entry : entry.path;
      const dash = typeof entry === "string" ? null : (entry.dash ?? null);
      for (const baked of bakePath(data)) paths.push({ d: baked, dash });
    }
    const rings = [];
    const dots = [];
    for (const dot of item.dots ?? []) {
      if (dot.ring || dot.stroke) {
        for (const baked of bakePath(circleToPath(dot.cx, dot.cy, dot.r))) {
          rings.push({ d: baked, accent: Boolean(dot.accent) });
        }
      } else {
        dots.push({ cx: round(dot.cx), cy: round(dot.cy), r: round(dot.r), accent: Boolean(dot.accent) });
      }
    }
    result[item.name] = { paths, rings, dots };
  }
  host.remove();
  return result;
}

function symbolMarkup(name, baked, viewBox, strokeWidth) {
  const lines = [`  <symbol id="cw-${name}" viewBox="${viewBox}">`];
  const open = [
    `    <g fill="none" stroke="currentColor" stroke-width="${strokeWidth}"`,
    `stroke-linecap="round" stroke-linejoin="round">`,
  ].join(" ");
  lines.push(open);
  for (const p of [...baked.paths, ...baked.rings]) {
    const dash = p.dash ? ` stroke-dasharray="${p.dash}"` : "";
    const accent = p.accent ? ` stroke="var(--cw-icon-accent, currentColor)"` : "";
    lines.push(`      <path d="${p.d}"${dash}${accent}/>`);
  }
  lines.push("    </g>");
  for (const dot of baked.dots) {
    const fill = dot.accent ? "var(--cw-icon-accent, currentColor)" : "currentColor";
    lines.push(`    <circle cx="${dot.cx}" cy="${dot.cy}" r="${dot.r}" fill="${fill}"/>`);
  }
  lines.push("  </symbol>");
  return lines.join("\n");
}

function spriteMarkup(presetName, iconBaked, graphicBaked) {
  const head = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<!-- GENERATED by scripts/icons-bake.mjs (preset ${presetName}) — do not edit.`,
    `     Geometry source: scripts/lib/icon-glyphs.mjs -->`,
    `<svg xmlns="http://www.w3.org/2000/svg" style="display:none">`,
  ];
  const body = [
    ...Object.keys(ICONS).map((name) =>
      symbolMarkup(name, iconBaked[name], ICON_VIEWBOX, STROKE_WIDTH.icon),
    ),
    ...Object.keys(GRAPHICS).map((name) =>
      symbolMarkup(name, graphicBaked[name], GRAPHIC_VIEWBOX, STROKE_WIDTH.graphic),
    ),
  ];
  return `${[...head, ...body, "</svg>", ""].join("\n")}`;
}

/**
 * Bake one or more presets in a single browser session.
 * Returns a Map of presetName -> { sprite, icons, graphics }.
 */
export async function bakeSprites(presetNames) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent("<!doctype html><html><body></body></html>");

  const iconItems = Object.entries(ICONS).map(([name, spec]) => ({ name, ...spec }));
  const graphicItems = Object.entries(GRAPHICS).map(([name, spec]) => ({ name, ...spec }));

  const out = new Map();
  try {
    for (const presetName of presetNames) {
      const preset = HAND_PRESETS[presetName];
      if (!preset) throw new Error(`unknown preset "${presetName}"`);
      const icons = await page.evaluate(bakeInPage, {
        items: iconItems,
        preset,
        sampleStep: SAMPLE_STEP,
      });
      const graphics = await page.evaluate(bakeInPage, {
        items: graphicItems,
        preset,
        sampleStep: SAMPLE_STEP * 1.5,
      });
      out.set(presetName, {
        sprite: spriteMarkup(presetName, icons, graphics),
        icons,
        graphics,
      });
    }
  } finally {
    await browser.close();
  }
  return out;
}

export { symbolMarkup, spriteMarkup };

