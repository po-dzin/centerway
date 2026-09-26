#!/usr/bin/env node
/**
 * Bakes the dosha result cards the support bot sends above a test result.
 *
 * WHY CODE, NOT A PHOTO
 * The menu cards are photographs; these are not, on purpose. A result is a
 * reading, not a place, and a picture of a thing would claim more than the test
 * does. So each dosha is a PRINT — the brand mark's own language of concentric
 * rings, pressed in the dosha's token colour on paper:
 *
 *   vata   open, broken arcs that drift — movement, air, ether
 *   pitta  rings drawn up into a flame — heat, direction
 *   kapha  a dense disc, held by level water lines — weight, ground
 *
 * A dual type overprints its two discs; tridosha lays all three together. The
 * colours are read from the token file, so a palette change re-bakes here too.
 *
 * Usage:
 *   node scripts/bot-dosha-cards.mjs            # write public/cw/bot/dosha/*.png
 *   node scripts/bot-dosha-cards.mjs --check    # fail if output differs on disk
 */

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const TOKENS = path.join(ROOT, "data/design-tokens/cw.tokens.json");
const MARK = path.join(ROOT, "public/cw/brand/cw-mark-ink.svg");
const OUT_DIR = "public/cw/bot/dosha";

const W = 1280;
const H = 800;

/** Deterministic noise, so a re-bake is byte-identical and `--check` means something. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

async function readTokens() {
  const raw = await fs.readFile(TOKENS, "utf8");
  const pick = (name) => {
    const match = raw.match(new RegExp(`"${name}":\\s*"(#[0-9a-fA-F]{6})"`));
    if (!match) throw new Error(`bot-dosha-cards: token ${name} not found as a hex value`);
    return match[1];
  };
  return {
    paper: pick("--cw-sem-calm-bg"),
    ink: pick("--cw-sem-guide-strong"),
    vata: pick("--cw-sem-trust"),
    pitta: pick("--cw-sem-warmth-strong"),
    kapha: pick("--cw-sem-embodied"),
  };
}

/* ── the three prints ─────────────────────────────────────────────────── */

function vataPrint(cx, cy, r, color, seed) {
  const rand = rng(seed);
  const parts = [];
  // Open arcs at growing radii, each with its own gap: nothing closes.
  for (let i = 0; i < 7; i += 1) {
    const rr = r * (0.22 + i * 0.12);
    const start = rand() * Math.PI * 2;
    const sweep = Math.PI * (0.9 + rand() * 0.8);
    const x1 = cx + rr * Math.cos(start);
    const y1 = cy + rr * Math.sin(start);
    const x2 = cx + rr * Math.cos(start + sweep);
    const y2 = cy + rr * Math.sin(start + sweep);
    const large = sweep > Math.PI ? 1 : 0;
    parts.push(
      `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} A${rr.toFixed(1)} ${rr.toFixed(1)} 0 ${large} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="${color}" stroke-width="${(r * 0.045).toFixed(1)}" stroke-linecap="round"/>`,
    );
  }
  // A few drifting motes on the outside: air leaving the form.
  for (let i = 0; i < 9; i += 1) {
    const a = rand() * Math.PI * 2;
    const d = r * (1.02 + rand() * 0.28);
    parts.push(
      `<circle cx="${(cx + d * Math.cos(a)).toFixed(1)}" cy="${(cy + d * Math.sin(a)).toFixed(1)}" r="${(r * (0.018 + rand() * 0.03)).toFixed(1)}" fill="${color}"/>`,
    );
  }
  parts.push(`<circle cx="${cx}" cy="${cy}" r="${(r * 0.08).toFixed(1)}" fill="${color}"/>`);
  return parts.join("");
}

function pittaPrint(cx, cy, r, color) {
  const parts = [];
  // Rings pulled up into a flame. The tip does not rise straight: it leans and
  // flicks back, more on the outer rings, so the form reads as fire licking up
  // rather than as a drop of water falling.
  for (let i = 0; i < 6; i += 1) {
    const k = 1 - i * 0.15;
    const rr = r * 0.78 * k;
    const baseY = cy + r * 0.3;
    const tipY = baseY - rr * 2.25;
    const lean = rr * 0.42;
    const tipX = cx + lean;
    const d = [
      `M${tipX.toFixed(1)} ${tipY.toFixed(1)}`,
      `C${(tipX - rr * 0.25).toFixed(1)} ${(tipY + rr * 0.55).toFixed(1)} ${(cx + rr * 1.25).toFixed(1)} ${(baseY - rr * 1.15).toFixed(1)} ${(cx + rr).toFixed(1)} ${(baseY - rr * 0.1).toFixed(1)}`,
      `A${rr.toFixed(1)} ${rr.toFixed(1)} 0 1 1 ${(cx - rr).toFixed(1)} ${(baseY - rr * 0.1).toFixed(1)}`,
      `C${(cx - rr * 1.1).toFixed(1)} ${(baseY - rr * 0.9).toFixed(1)} ${(cx - rr * 0.55).toFixed(1)} ${(baseY - rr * 1.25).toFixed(1)} ${(cx - rr * 0.2).toFixed(1)} ${(baseY - rr * 1.45).toFixed(1)}`,
      `C${(cx + rr * 0.15).toFixed(1)} ${(baseY - rr * 1.7).toFixed(1)} ${(tipX - rr * 0.05).toFixed(1)} ${(tipY + rr * 0.45).toFixed(1)} ${tipX.toFixed(1)} ${tipY.toFixed(1)}Z`,
    ].join(" ");
    parts.push(
      i === 5
        ? `<path d="${d}" fill="${color}"/>`
        : `<path d="${d}" fill="none" stroke="${color}" stroke-width="${(r * 0.045).toFixed(1)}" stroke-linejoin="round"/>`,
    );
  }
  return parts.join("");
}

function kaphaPrint(cx, cy, r, color, paper) {
  const id = `kclip${Math.round(cx)}${Math.round(cy)}`;
  const parts = [`<defs><clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs>`];
  parts.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>`);
  // Level water lines cut into the lower half of the disc, in the paper colour.
  const lines = [];
  for (let i = 0; i < 6; i += 1) {
    const y = cy + r * (0.12 + i * 0.15);
    const amp = r * 0.035;
    const step = r * 0.25;
    let d = `M${(cx - r).toFixed(1)} ${y.toFixed(1)}`;
    for (let x = cx - r; x < cx + r; x += step) {
      d += ` q${(step / 2).toFixed(1)} ${(-amp).toFixed(1)} ${step.toFixed(1)} 0`;
    }
    lines.push(
      `<path d="${d}" fill="none" stroke="${paper}" stroke-width="${(r * 0.03).toFixed(1)}" stroke-linecap="round"/>`,
    );
  }
  parts.push(`<g clip-path="url(#${id})">${lines.join("")}</g>`);
  // One outer ring, a breath away: the brand mark's edge.
  parts.push(
    `<circle cx="${cx}" cy="${cy}" r="${(r * 1.1).toFixed(1)}" fill="none" stroke="${color}" stroke-width="${(r * 0.03).toFixed(1)}"/>`,
  );
  return parts.join("");
}

/* ── the sheet ────────────────────────────────────────────────────────── */

function sheet(t, body, markInner) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <filter id="grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.13  0 0 0 0 0.19  0 0 0 0 0.15  0 0 0 0.055 0"/>
    </filter>
    <filter id="press" x="-10%" y="-10%" width="120%" height="120%">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="3" result="warp"/>
      <feDisplacementMap in="SourceGraphic" in2="warp" scale="7" xChannelSelector="R" yChannelSelector="G" result="warped"/>
      <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="1" seed="11" result="speck"/>
      <feColorMatrix in="speck" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.75" result="mask"/>
      <feComposite in="warped" in2="mask" operator="in" result="inked"/>
      <feComponentTransfer in="inked"><feFuncA type="linear" slope="0.9"/></feComponentTransfer>
    </filter>
    <radialGradient id="light" cx="30%" cy="25%" r="85%">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#8a5a2b" stop-opacity="0.05"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${t.paper}"/>
  <rect width="${W}" height="${H}" fill="url(#light)"/>
  <g filter="url(#press)">${body}</g>
  <g transform="translate(${W - 96} ${H - 96}) scale(0.9)" opacity="0.55" fill="${t.ink}">${markInner}</g>
  <rect width="${W}" height="${H}" filter="url(#grain)"/>
</svg>`;
}

const CX = W / 2;
const CY = H / 2 + 10;
const R = 250;

function compose(t) {
  const one = {
    vata: (cx, cy, r) => vataPrint(cx, cy, r, t.vata, 21),
    pitta: (cx, cy, r) => pittaPrint(cx, cy, r, t.pitta),
    kapha: (cx, cy, r) => kaphaPrint(cx, cy, r, t.kapha, t.paper),
  };
  /* Overprint: the second disc at 0.85 so the two inks visibly cross. */
  const pair = (a, b) =>
    `<g>${one[a](CX - 150, CY, R * 0.8)}</g><g opacity="0.85">${one[b](CX + 150, CY, R * 0.8)}</g>`;
  return {
    vata: one.vata(CX, CY, R),
    pitta: one.pitta(CX, CY + 40, R),
    kapha: one.kapha(CX, CY, R * 0.86),
    vata_pitta: pair("vata", "pitta"),
    pitta_kapha: pair("pitta", "kapha"),
    vata_kapha: pair("vata", "kapha"),
    tridosha:
      `<g>${one.kapha(CX, CY + 95, R * 0.5)}</g>` +
      `<g opacity="0.88">${one.vata(CX - 165, CY - 55, R * 0.58)}</g>` +
      `<g opacity="0.88">${one.pitta(CX + 165, CY - 25, R * 0.58)}</g>`,
  };
}

async function main() {
  const check = process.argv.includes("--check");
  const t = await readTokens();
  const markSvg = await fs.readFile(MARK, "utf8");
  const markInner = markSvg
    .replace(/^[\s\S]*?<svg[^>]*>/, "")
    .replace(/<\/svg>\s*$/, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  let failed = 0;
  for (const [type, body] of Object.entries(compose(t))) {
    const png = await sharp(Buffer.from(sheet(t, body, markInner)))
      .png({ compressionLevel: 9, palette: false })
      .toBuffer();
    const rel = `${OUT_DIR}/${type}.png`;
    const abs = path.join(ROOT, rel);
    if (check) {
      const onDisk = await fs.readFile(abs).catch(() => null);
      if (!onDisk || Buffer.compare(onDisk, png) !== 0) {
        console.error(`bot-dosha-cards: ${rel} is stale`);
        failed += 1;
      }
      continue;
    }
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, png);
    console.log(`bot-dosha-cards: wrote ${rel} (${Math.round(png.length / 1024)} KB)`);
  }
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
