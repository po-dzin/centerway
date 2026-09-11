import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { isChromeSheetOpen, markChromeSheetOpen } from "./chromeSheetStore";

const root = path.resolve(__dirname, "../../../..");
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "");

const menuSource = read("src/components/platform/layout/PlatformAccountMenu.tsx");
const shellCss = stripComments(read("src/components/platform/PlatformShell.module.css"));
const globals = stripComments(read("src/app/globals.css"));
const revealSource = stripComments(read("src/components/platform/layout/useChromeReveal.ts"));
const sheetSource = stripComments(read("src/components/platform/layout/ChromeSheet.tsx"));

/** The declaration block of the first rule whose selector list matches. */
const block = (css: string, selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, "m").exec(css)?.[1] ?? "";
};

describe("account menu: every marked row opts into the ink rules", () => {
  /**
   * THE REGRESSION THIS EXISTS FOR. The stroke's hover and focus rules key on
   * `:is(.cw-tab, .cw-nav-link, [data-cw-ink-control])`. Menu rows are bare
   * `<a>` and `<button>` with no class, so a row that forgets the attribute
   * renders an ink label whose mark can never be painted by anything but
   * `data-cw-ink-active` — it looks finished and is inert under the cursor.
   * That is not visible in review, which is why it is asserted here.
   */
  it("gives every InkMenuLabel row the attribute the ink rules key on", () => {
    const rows = [...menuSource.matchAll(/<InkMenuLabel[\s>]/g)];
    expect(rows.length).toBeGreaterThanOrEqual(6);

    for (const match of rows) {
      const before = menuSource.slice(0, match.index);
      /* The row element that encloses this label — the nearest preceding
         opening tag of something a reader can press. */
      const tagStart = Math.max(
        before.lastIndexOf("<a\n"),
        before.lastIndexOf("<a "),
        before.lastIndexOf("<button"),
        before.lastIndexOf("<Link"),
        before.lastIndexOf("<summary"),
      );
      expect(tagStart, `no row element found before an InkMenuLabel`).toBeGreaterThan(-1);
      const tag = menuSource.slice(tagStart, match.index);
      const carriesDirectly = tag.includes("{...INK_ROW}");
      const carriesViaShared = tag.includes("{...shared}");
      expect(
        carriesDirectly || carriesViaShared,
        `a row rendering InkMenuLabel is missing data-cw-ink-control:\n${tag.trim().slice(0, 220)}`,
      ).toBe(true);
    }
  });

  it("defines INK_ROW as the attribute the globals rules actually read", () => {
    expect(menuSource).toMatch(/const INK_ROW = \{ "data-cw-ink-control": "" \} as const;/);
    expect(menuSource).toMatch(/\.\.\.INK_ROW,\n\s+onClick/);
  });

  it("keeps [data-cw-ink-control] in the stroke's hover and focus selector list", () => {
    /* Narrowing this list again is what silently unpaints every control that
       has no class of its own — the footer met this once already. */
    const hover = /:is\(\.cw-tab, \.cw-nav-link, \[data-cw-ink-control\]\):hover \.cw-ink-label-mark/;
    const focus = /:is\(\.cw-tab, \.cw-nav-link, \[data-cw-ink-control\]\):focus-visible \.cw-ink-label-mark/;
    expect(globals).toMatch(hover);
    expect(globals).toMatch(focus);
  });
});

describe("account menu: ink strength on a plate with no fixed ground", () => {
  it("rests the rows at full ink rather than a muted step", () => {
    const rows = block(shellCss, ".profileMenu a,\n.profileMenu button");
    expect(rows).toContain("color: var(--cw-platform-text)");
    /* The popover is a 30% tint over a blur: a muted ink has nothing stable to
       be measured against, which is what read as "not dark enough". */
    expect(rows).not.toContain("--cw-platform-muted");
  });

  it("keeps the setting's label in the same column of ink as the rows", () => {
    const label = block(shellCss, ".menuSettingLabel");
    expect(label).toContain("color: var(--cw-platform-text)");
    expect(label).not.toContain("--cw-platform-muted");
  });

  it("leaves the dark tone on its own measured step", () => {
    /* The night side already made this trade and measured it; full ink there
       would be a different change, not this one. */
    expect(shellCss).toMatch(
      /\.profileMenu\[data-cw-header-tone="dark"\] a,[\s\S]*?color-mix\(in srgb, var\(--cw-platform-accent-contrast\) 78%, transparent\)/,
    );
  });
});

describe("account menu: both separators read the same signal", () => {
  it("names the surface its rule is drawn on", () => {
    expect(menuSource).toMatch(/className=\{styles\.menuIdentity\} data-cw-rule="chrome"/);
  });

  it("points the chrome rule at the tone, not at a header variable a portal cannot see", () => {
    /* `--platform-header-fg` is out of scope in a portal, so the plain `chrome`
       scope falls back to `--cw-platform-text`: a dark hairline on a dark
       plate. The tone is the only thing this element knows about its ground. */
    const toned = block(
      globals,
      '[data-cw-header-tone="dark"] [data-cw-rule="chrome"],\n[data-cw-rule="chrome"][data-cw-header-tone="dark"]',
    );
    expect(toned).toContain("--cw-rule-ink");
    expect(toned).toContain("white 16%");
  });

  it("draws the identity rule and the divider from the same ink under a dark tone", () => {
    const divider = block(
      shellCss,
      '[data-cw-header-tone="dark"] .profileWrapMobile .profileMenuDivider,\n.profileMenu[data-cw-header-tone="dark"] .profileMenuDivider',
    );
    expect(divider).toContain("white 16%");
  });
});

describe("chrome sheets hold the chrome they hang from", () => {
  it("publishes while a sheet is open and releases when it closes", () => {
    expect(isChromeSheetOpen()).toBe(false);
    const release = markChromeSheetOpen();
    expect(isChromeSheetOpen()).toBe(true);
    release();
    expect(isChromeSheetOpen()).toBe(false);
  });

  it("survives two sheets overlapping for a frame during a navigation", () => {
    const first = markChromeSheetOpen();
    const second = markChromeSheetOpen();
    first();
    /* The first sheet closing must not clear a mark the second still needs. */
    expect(isChromeSheetOpen()).toBe(true);
    second();
    expect(isChromeSheetOpen()).toBe(false);
  });

  it("treats a repeated release as a no-op", () => {
    /* StrictMode runs an effect's cleanup twice in development; a second
       decrement would let the bar walk off with a sheet still on screen. */
    const release = markChromeSheetOpen();
    const other = markChromeSheetOpen();
    release();
    release();
    release();
    expect(isChromeSheetOpen()).toBe(true);
    other();
    expect(isChromeSheetOpen()).toBe(false);
  });

  it("never counts below zero", () => {
    const release = markChromeSheetOpen();
    release();
    release();
    expect(isChromeSheetOpen()).toBe(false);
    const next = markChromeSheetOpen();
    expect(isChromeSheetOpen()).toBe(true);
    next();
    expect(isChromeSheetOpen()).toBe(false);
  });

  it("marks the sheet open for exactly as long as the panel is open", () => {
    expect(sheetSource).toMatch(/if \(!open\) return;\n\s+return markChromeSheetOpen\(\);/);
  });

  it("holds the reveal on the sheet as well as on the burger", () => {
    expect(revealSource).toContain("useSyncExternalStore");
    expect(revealSource).toMatch(/const held = locked \|\| \(anchorsSheets && sheetOpen\);/);
    /* All three sites, or the hold is half applied: the listener would still
       attach, or the derived return would still report hidden. */
    expect(revealSource).toContain("if (!enabled || held) return;");
    expect(revealSource).toContain("}, [enabled, held, ref]);");
    expect(revealSource).toContain("if (!enabled || held) return { hidden: false, deep: state.deep };");
  });

  it("holds only chrome a sheet can be anchored to", () => {
    /* The reader's back-to-top button anchors nothing. Holding it would make
       an unrelated control APPEAR when the account menu opened, which is a new
       bug rather than a fix for the reported one. */
    const topButton = read("src/components/lms/ReaderTopButton.tsx");
    expect(topButton).toMatch(/useChromeReveal\(true, undefined, \{ anchorsSheets: false \}\)/);
  });
});
