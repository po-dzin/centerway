import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ReaderChrome } from "./ReaderChrome";
import { ZenPreviewContext } from "./ZenPreviewContext";

const read = (file: string) => fs.readFileSync(path.resolve(__dirname, "../../..", file), "utf8");
const rule = (source: string, name: string) => new RegExp(`\\.${name}\\s*\\{([^}]+)}`).exec(source)?.[1] ?? "";

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
    expect(html.match(/До редагування/g)).toHaveLength(1);
    expect(html).toContain("До редагування</span></button>");
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
    for (const name of ["drawer", "noteEditor"]) {
      expect(rule(css, name)).toContain("box-shadow: var(--cw-mat-shadow-deep)");
    }
    for (const name of ["sizeMenu", "markToolbar"]) {
      expect(rule(css, name)).toContain("box-shadow: var(--cw-mat-shadow-raised)");
    }
    const chrome = rule(css, "readerChrome");
    expect(chrome).toContain("env(safe-area-inset-top)");
    expect(chrome).toContain("max-inline-size: 46rem");
    expect(chrome).toContain("margin-inline: auto");
    expect(rule(css, "readerPreviewBack")).toContain("base chrome hug");
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
