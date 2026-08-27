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

  it("keeps the mark's stroke colour answerable to both themes", () => {
    expect(offlineHtml).toMatch(/prefers-color-scheme:\s*dark/);
    const darkBlock = /@media \(prefers-color-scheme: dark\)\s*\{([\s\S]*?)\}\s*<\/style>/.exec(offlineHtml)?.[1] ?? "";
    expect(darkBlock).toContain(".mark");
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
