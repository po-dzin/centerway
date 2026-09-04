import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The offline fallback (`public/offline.html`) and the worker that serves it
 * (`public/sw.js`), as tests rather than as a note in a PR description.
 *
 * Neither file goes through Next's pipeline — `public/**` is served byte for
 * byte, and the worker is the one thing on the platform that MUST work with
 * no network at all, so it cannot reference a hashed asset. That is also
 * exactly why nothing catches a broken edit to either file automatically:
 * there is no build step to fail. These assertions are the build step.
 */

const publicDir = path.resolve(__dirname, "../../../../public");
const offlineHtml = fs.readFileSync(path.join(publicDir, "offline.html"), "utf8");
const swJs = fs.readFileSync(path.join(publicDir, "sw.js"), "utf8");

describe("offline.html stays self-contained", () => {
  /**
   * This document has to render with nothing on the network. A reference to
   * a hashed Next asset, a Google Fonts link, an external stylesheet — any of
   * them would make the one page promised to work offline the one page that
   * cannot.
   */
  it("loads nothing from the network", () => {
    expect(offlineHtml).not.toMatch(/<link[^>]+rel=["']?(?:stylesheet|preload|modulepreload)/i);
    expect(offlineHtml).not.toMatch(/<script[^>]+src=/i);
    expect(offlineHtml).not.toMatch(/https?:\/\//);
    // `_next/static/...` — a build-hashed path can't be re-fetched offline.
    expect(offlineHtml).not.toContain("_next/");
  });

  it("carries the broken-mark illustration as inline paths, not an external icon", () => {
    expect(offlineHtml).toContain("<svg");
    // Three arcs, three dasharrays — one ring left whole would read as a
    // decorative circle rather than the mark under strain.
    const dasharrays = [...offlineHtml.matchAll(/stroke-dasharray="([^"]+)"/g)];
    expect(dasharrays).toHaveLength(3);
    for (const [, pattern] of dasharrays) {
      expect(pattern.trim().split(/\s+/).length).toBeGreaterThan(2);
    }
  });

  /**
   * Both gammas since 2026-09-05, and with the same precedence the rest of the
   * product uses: a stored choice first, `prefers-color-scheme` only when
   * there is none. The page used to hold the light ground at night because the
   * dark inverse was a flat green field; the dark ground has been graphite
   * since 2026-08-28, so what was left was a cream page full-bleed to a reader
   * whose whole product is graphite.
   *
   * The media query is allowed HERE and forbidden in globals.css because this
   * file has one palette and no course pack to keep in step with it — but that
   * only holds while the two dark blocks say exactly the same thing, so they
   * are compared rather than trusted.
   */
  const darkBlocks = () => {
    const blocks = [
      /@media \(prefers-color-scheme: dark\) \{\s*:root:not\(\[data-cw-theme="light"\]\) \{([^}]*)\}/,
      /:root\[data-cw-theme="dark"\] \{([^}]*)\}/,
    ].map((pattern) => offlineHtml.match(pattern)?.[1]);
    return blocks;
  };

  it("carries a dark ground for the OS setting and for a stored choice", () => {
    const [fromMedia, fromStamp] = darkBlocks();
    expect(fromMedia).toBeTruthy();
    expect(fromStamp).toBeTruthy();
    // One palette, written twice because CSS has no other way to say it.
    expect(fromStamp?.trim()).toBe(fromMedia?.trim());
    // The graphite ground, not the green night the objection was about.
    expect(fromStamp).toContain("--ground: #191918;");
    expect(fromStamp).toMatch(/color-scheme:\s*dark;/);
  });

  /**
   * The stored choice has to beat the OS in BOTH directions, and the page has
   * to render correctly with no JavaScript at all — it is the one page that
   * must survive a dead network. So the script only ever stamps an explicit
   * light/dark choice: no `matchMedia` branch, no default. An unstamped
   * document is the "system" case, which the stylesheet answers on its own.
   */
  it("stamps only an explicit choice, and leaves system to the stylesheet", () => {
    expect(offlineHtml).toContain('localStorage.getItem("cw-theme")');
    expect(offlineHtml).not.toContain("matchMedia");
    // The light stamp needs no palette of its own — it wins by excluding
    // itself from the media block above.
    expect(offlineHtml).toContain(':root:not([data-cw-theme="light"])');
  });

  /**
   * `theme-color` is the surround — the iOS status bar and the installed
   * window's title bar — and a page that themes itself while the bar behind it
   * stays cream is worse than one that does neither.
   */
  it("paints the browser's surround in both gammas", () => {
    expect(offlineHtml).toContain('<meta name="theme-color" content="#faefe0" media="(prefers-color-scheme: light)">');
    expect(offlineHtml).toContain('<meta name="theme-color" content="#191918" media="(prefers-color-scheme: dark)">');
  });
});

describe("the service worker's cache version follows its precached content", () => {
  /**
   * The worker only reinstalls when ITS OWN bytes differ from what a client
   * already has — that is the spec, not a bug to work around. A content-only
   * edit to `offline.html` changes nothing in `sw.js`, so without a bump here
   * an already-installed client keeps serving the stale page from the Cache
   * API forever: there is no expiry on it, and `activate` only evicts cache
   * keys that are not the current `SHELL_CACHE` name.
   */
  it("declares SHELL_CACHE as a versioned literal", () => {
    expect(swJs).toMatch(/const SHELL_CACHE = "cw-shell-v\d+";/);
  });

  it("still precaches exactly /offline.html", () => {
    expect(swJs).toContain('const OFFLINE_URL = "/offline.html";');
  });
});
