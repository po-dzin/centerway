#!/usr/bin/env node
/**
 * Carrier guard — "one carrier per block".
 *
 * A carrier is what a block says something with besides its text: a photograph,
 * a document (screenshot of a real message), an icon, a hand graphic. Two of
 * them in one block compete for the same job, and the reader cannot tell which
 * one is the point. way21's phase cards used to open with four at once (photo +
 * accent stripe + icon chip + kicker) — this guard exists so that does not come
 * back the next time someone edits copy.
 *
 * The rule is per *section*, not per page: a landing is expected to carry
 * several kinds across its length. What it may not do is stack them.
 *
 * Chrome is not a carrier. Chevrons, carousel arrows and the arrow inside a
 * button are excluded by glyph name. A handful of affordances reuse a content
 * glyph (the play badge on a video thumbnail, the check on a guarantee line);
 * those declare themselves with `class="ico ico-chrome"`. That is a
 * declaration, not a loophole — it is one grep away from review.
 *
 * Scope: all five CenterWay landings are enforced (2026-08-17 — way21 first as
 * the reference organism, then the other four the same day). --surface narrows
 * the check to one while working on it.
 *
 * Usage:
 *   node scripts/guard-carriers.mjs                   # fail on violations
 *   node scripts/guard-carriers.mjs --report          # print every block
 *   node scripts/guard-carriers.mjs --surface dosha   # one landing
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(import.meta.dirname, "..");
const LANDINGS = path.join(ROOT, "src/landing-static");

/**
 * The CenterWay network only. Short and IREM are other authors with their own
 * visual territory and their own stylesheets — they are deliberately not held
 * to this rule (see the multi-author note in docs/design-system.md).
 */
const SURFACES = ["way21", "reset-day", "consult", "herbs", "dosha"];

/** Glyphs that are affordances rather than content. */
const CHROME_GLYPHS = new Set(["chevron-down", "chevron-right", "arrow-right", "arrow-left", "menu", "close"]);

/** The hand-graphics primitives, whatever they are drawn with. */
const GRAPHIC_GLYPHS = new Set(["dot", "orbit", "rail", "connector"]);

/**
 * Accepted exceptions, each with the reason. An entry here is a decision, not a
 * silencer — if the reason stops being true, delete the line and fix the block.
 */
const ALLOW = {};

/**
 * Emoji, not typography. A star or a check drawn as a plain glyph (★ ✓ —) is a
 * typographic character and stays: it inherits the type colour and metrics. An
 * emoji is a picture with its own palette that no stylesheet can reach, so it
 * is never a carrier. The test is emoji presentation (VS16) or the pictographic
 * blocks — which is exactly the line between the two.
 */
const EMOJI = /(?:[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]\u{FE0F})/gu;

/** Splits a document into top-level sections, keeping the opening tag. */
function sections(html) {
  const body = html.slice(html.indexOf("<body"));
  return body
    .split(/(?=<section\b)/g)
    .slice(1)
    .map((chunk) => {
      const end = chunk.indexOf("</section>");
      return end === -1 ? chunk : chunk.slice(0, end);
    });
}

function label(section, index) {
  const id = section.match(/^<section[^>]*\bid="([^"]+)"/);
  if (id) return id[1];
  const cls = section.match(/^<section[^>]*\bclass="([a-z0-9-]+)/);
  if (cls && cls[1] !== "sec") return cls[1];
  const heading = section.match(/<h2[^>]*>([\s\S]{0,80}?)<\/h2>/);
  const text = heading ? heading[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : "";
  return text ? `${index}:${text.slice(0, 34)}` : `${index}`;
}

function carriersOf(section) {
  const found = new Map();
  const add = (kind, evidence) => {
    if (!found.has(kind)) found.set(kind, new Set());
    found.get(kind).add(evidence);
  };

  for (const [, src] of section.matchAll(/<img[^>]*\bsrc="([^"]+)"/g)) {
    const file = src.split("/").pop();
    if (/cw-logo|visa-mc/.test(file)) continue; // brand chrome
    if (src.includes("/feedback/") || /screenshot|inshot|poster-/i.test(file)) add("document", file);
    else add("photo", file);
  }

  const chromeMarked = (section.match(/class="[^"]*\bico-chrome\b[^"]*"/g) || []).length;
  let chromeBudget = chromeMarked;
  for (const [, id] of section.matchAll(/<use[^>]*href="[^"#]*#cw-([a-z0-9-]+)"/g)) {
    if (CHROME_GLYPHS.has(id)) continue;
    if (chromeBudget > 0) { chromeBudget -= 1; continue; }
    if (GRAPHIC_GLYPHS.has(id)) add("graphic", id);
    else add("icon", id);
  }

  // Inline SVG that is not a brand mark still counts as an icon: the migration
  // to the sprite must not be side-steppable by pasting a path back in.
  const inline = section.match(/<svg(?![^>]*class="(?:ico|gfx)\b)[^>]*>/g) || [];
  const brandMarks = (section.match(/class="soc[^"]*"/g) || []).length;
  if (inline.length > brandMarks) add("icon", `${inline.length - brandMarks} inline <svg>`);

  // CSS-drawn primitives declare themselves with a class, since there is no
  // element to inspect.
  if (/class="[^"]*\brail-node\b/.test(section)) add("graphic", "rail");

  const emoji = section.match(EMOJI) || [];
  if (emoji.length) add("emoji", [...new Set(emoji)].join(""));

  return found;
}

function main() {
  const report = process.argv.includes("--report");
  const only = process.argv.includes("--surface") ? process.argv[process.argv.indexOf("--surface") + 1] : null;
  const rows = [];
  let violations = 0;

  for (const surface of SURFACES) {
    if (only && surface !== only) continue;
    const file = path.join(LANDINGS, surface, "index.html");
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, "utf8");

    sections(html).forEach((section, index) => {
      const name = label(section, index);
      const key = `${surface}:${name}`;
      const found = carriersOf(section);
      const kinds = [...found.keys()];
      const material = kinds.filter((k) => k !== "emoji");

      const overloaded = material.length > 1;
      const hasEmoji = found.has("emoji");
      const excused = ALLOW[key];

      if (report || overloaded || hasEmoji) {
        rows.push({
          key,
          kinds,
          detail: kinds.map((k) => `${k}(${[...found.get(k)].slice(0, 3).join(", ")})`).join(" + "),
          bad: (overloaded && !excused) || hasEmoji,
          excused: Boolean(excused) && overloaded,
        });
      }
      if ((overloaded && !excused) || hasEmoji) violations += 1;
    });
  }

  for (const row of rows) {
    const mark = row.bad ? "FAIL" : row.excused ? "ok  " : "    ";
    console.log(`${mark} ${row.key.padEnd(34)} ${row.detail}`);
  }

  if (violations) {
    console.error(
      `\n[FAIL] Carrier guard — ${violations} block(s) carry more than one carrier, or carry an emoji.` +
        `\n       One carrier per block: photo, document, icon or graphic. Emoji are never a carrier.` +
        `\n       Map and rationale: docs/archive/working-notes/ds-carrier-map-2026-08-17.md`,
    );
    process.exit(1);
  }
  console.log(`\n[PASS] Carrier guard${only ? ` — ${only}` : ""}`);
}

main();
