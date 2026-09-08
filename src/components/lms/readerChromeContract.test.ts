import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReaderChrome } from "./ReaderChrome";
import { ZenPreviewContext } from "./ZenPreviewContext";

const read = (file: string) => fs.readFileSync(path.resolve(__dirname, "../../..", file), "utf8");
/* ANCHORED TO THE DEFINITION, not to the first mention (2026-09-07). Unanchored,
   `.organ` matched inside `.row[data-cw-organs-sheet="open"] .organ` — a
   variant rule that happens to sit earlier in the file — so adding any variant
   above a definition silently pointed these assertions at the wrong block. The
   definitions are written one selector per line at column zero; the variants
   never are. */
const rule = (source: string, name: string) =>
  new RegExp(`^\\.${name}\\s*\\{([^}]+)}`, "m").exec(source)?.[1] ?? "";

describe("reader / author preview chrome contract", () => {
  it("keeps the learner's back route and reading tools in one row", () => {
    const html = renderToStaticMarkup(createElement(ReaderChrome, {
      backHref: "/learn/example", backLabel: "До курсу: приклад",
      tools: createElement("button", null, "Зміст курсу"),
    }));
    expect(html).toContain('href="/learn/example"');
    expect(html).toContain("До курсу: приклад");
    expect(html).toContain("Зміст курсу");
    expect(html).not.toContain("Чернетка");
  });

  it("replaces the back action with one author return, keeping the same tools", () => {
    const html = renderToStaticMarkup(createElement(ZenPreviewContext.Provider, {
      value: { returnToBuilder: () => undefined },
    }, createElement(ReaderChrome, {
      backHref: "/learn/example?preview=draft",
      tools: createElement("button", null, "Зміст курсу"),
    })));
    /* THE ARROW CARRIES THE WORD, IT DOES NOT PRINT IT (2026-09-07): the label
       is on the control twice, for the screen reader and for the tooltip, and
       nowhere in the row — an empty loading screen with one captioned pill on
       it made the chrome the subject of the page. */
    expect(html.match(/До редагування/g)).toHaveLength(2);
    expect(html).toContain('aria-label="До редагування"');
    expect(html).not.toContain("До редагування</span>");
    expect(html).not.toContain("Чернетка");
    expect(html).not.toContain("збережено");
    expect(html).toContain("Зміст курсу");
    expect(html).not.toContain('href="/learn/');
  });

  it("has no stacked preview header and keeps return context on lesson routes", () => {
    const shell = read("src/components/lms/ZenPreviewShell.tsx");
    expect(shell).not.toContain("<header");
    expect(shell).toContain("!reader ? <ReaderChrome");
    expect(shell).toContain("window.history.go(saved.historyIndex - currentIndex)");
    expect(read("src/app/(platform)/learn/[course]/[lesson]/page.tsx")).toContain("returnTo={previewReturnTo} reader");
    const lesson = read("src/components/lms/LessonView.tsx");
    expect(lesson.match(/<ReaderChrome/g)).toHaveLength(3); // loading, failure, ready
    expect(lesson).toContain("locked={contentsOpen}");
    expect(lesson).toContain("!draftPreview");
    expect(lesson).toContain("previewReturnTo={previewReturnTo}");
    expect(read("src/components/lms/ZenPreview.module.css")).not.toContain("zen-boundary-block");
  });

  it("uses DS elevation, never foreground-coloured glow, for reader overlays", () => {
    const css = read("src/components/lms/Lms.module.css");
    /* THE SHEET MOVED ONE HOP (2026-09-06), the same way the reader's chrome row
       did below: the drawer and the note editor were two of four bottom sheets
       in the product with two ceilings, two measures and one handle between
       them, and the material they share is `BottomSheet.module.css` now. The
       contract follows it and keeps both halves — that the reader still
       composes the recipe, and that the recipe still carries the elevation this
       assertion was written to protect. */
    const sheet = read("src/components/platform/layout/BottomSheet.module.css");
    for (const name of ["drawer", "noteEditor"]) {
      expect(rule(css, name)).toContain('composes: sheet from "../platform/layout/BottomSheet.module.css"');
    }
    expect(rule(sheet, "sheet")).toContain("box-shadow: var(--cw-mat-shadow-deep)");
    expect(rule(sheet, "sheet")).toContain("border-radius: var(--cw-radius-xl) var(--cw-radius-xl) 0 0");
    for (const name of ["sizeMenu", "markToolbar"]) {
      expect(rule(css, name)).toContain("box-shadow: var(--cw-mat-shadow-raised)");
    }
    /* The reader's row, island and cluster moved to `ChromeOrgans.module.css`
       on 2026-09-05, where the library and every future bar-less surface read
       the same recipe. The contract did not move with them — it followed one
       hop: this asserts that the reader still COMPOSES that row, and that the
       row still carries the geometry it was written to protect. Asserting only
       the `composes` line would let the numbers drift; asserting only the
       shared module would let the reader quietly stop using it. */
    const organs = read("src/components/platform/layout/ChromeOrgans.module.css");
    expect(rule(css, "readerChrome")).toContain('composes: row from "../platform/layout/ChromeOrgans.module.css"');
    expect(rule(css, "readerBack")).toContain('composes: organ from "../platform/layout/ChromeOrgans.module.css"');
    expect(rule(css, "readerTools")).toContain('composes: cluster from "../platform/layout/ChromeOrgans.module.css"');
    const row = rule(organs, "row");
    expect(row).toContain("env(safe-area-inset-top)");
    expect(row).toContain("max-inline-size: 46rem");
    expect(row).toContain("margin-inline: auto");
    /* The islands take the touch target, not their glyph — the one number a
       redraw of this material is most likely to lose. */
    expect(rule(organs, "organ")).toContain("var(--ds-touch-target-min)");
    expect(rule(organs, "cluster")).toContain("min-height: var(--ds-touch-target-min)");
    /* The author's way out of the preview is the SAME island as the reader's
       way out of a lesson since 2026-09-07 — it used to compose a button role
       because it carried a word, and it no longer carries one. */
    expect(rule(css, "readerPreviewBack")).toContain('composes: organ from "../platform/layout/ChromeOrgans.module.css"');
  });

  it("gives sidebar append commands the shared themed button recipe", () => {
    const css = read("src/components/builder/Builder.module.css");
    const append = rule(css, "contentsAddModule");
    expect(append).toContain("composes: base secondary hug");
    expect(append).not.toContain("accent-strong");
    const secondary = rule(read("src/components/platform/PlatformButtons.module.css"), "secondary");
    expect(secondary).toContain("color: var(--cw-platform-text)");
    expect(secondary).toContain("--cw-mat-stroke-quiet");
  });
});
