import fs from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PlatformBackOrgan } from "./PlatformOrgans";

const read = (file: string) => fs.readFileSync(path.resolve(__dirname, "../../../..", file), "utf8");
const rule = (source: string, selector: string) => {
  const at = source.indexOf(`${selector} {`);
  if (at < 0) return "";
  return source.slice(at + selector.length + 2, source.indexOf("}", at));
};

/**
 * THE LABELLED WAY BACK (2026-09-19). The phone's leading island carries a
 * short word beside the arrow — the level it returns to — and the full
 * destination stays the accessible name. Without a word it is the round arrow
 * it always was, so every surface that has not opted in is unchanged.
 */
describe("PlatformBackOrgan", () => {
  it("stays a round arrow with only an accessible name when given no word", () => {
    const html = renderToStaticMarkup(
      createElement(PlatformBackOrgan, { href: "/learn", label: "До моїх матеріалів" }),
    );
    expect(html).toContain('aria-label="До моїх матеріалів"');
    expect(html).toContain('href="/learn"');
    expect(html).not.toContain("organText");
    expect(html).not.toContain("organLabelled");
  });

  it("prints the word beside the arrow and keeps the full destination as its name", () => {
    const html = renderToStaticMarkup(
      createElement(PlatformBackOrgan, { href: "/build/courses", label: "Назад: Матеріали", text: "Матеріали" }),
    );
    expect(html).toContain('aria-label="Назад: Матеріали"');
    expect(html).toContain("organLabelled");
    expect(html).toMatch(/organText[^>]*>Матеріали</);
  });

  /* The workshop must be able to ask before it leaves an unsaved document, so
     the callback form is a button, not a link — with or without a word. */
  it("is a button, not a link, when the surface has to confirm before leaving", () => {
    const html = renderToStaticMarkup(
      createElement(PlatformBackOrgan, { onNavigate: () => {}, label: "Назад: Курс", text: "До курсу" }),
    );
    const opening = html.slice(0, html.indexOf(">") + 1);
    expect(opening.startsWith("<button")).toBe(true);
    expect(opening).toContain('type="button"');
    // The icon's own `<use href>` is inside; the control itself has none.
    expect(opening).not.toContain("href=");
    expect(html).toContain("До курсу");
  });

  it("never lets the word widen the island past a third of the phone", () => {
    const css = read("src/components/platform/layout/ChromeOrgans.module.css");
    expect(rule(css, ".organLabelled")).toContain("max-width: min(12rem, 45vw)");
    const text = rule(css, ".organText");
    expect(text).toContain("text-overflow: ellipsis");
    expect(text).toContain("white-space: nowrap");
    // The arrow keeps its box: the labelled island is the same touch height.
    expect(rule(css, ".organ")).toContain("height: var(--ds-touch-target-min)");
  });
});

describe("where the labelled way back is used", () => {
  it("names the library, not the page, on the library's own inner screens", () => {
    for (const page of ["src/app/(platform)/learn/[course]/page.tsx", "src/app/(platform)/journal/page.tsx"]) {
      expect(read(page)).toContain('text: "Бібліотека"');
    }
    expect(read("src/components/platform/PlatformLayout.tsx")).toContain("text={back.text}");
  });

  it("derives the workshop's word from the trail on every builder screen", () => {
    const shell = read("src/components/builder/BuilderShell.tsx");
    expect(shell).toContain("leadingBack(trail)");
    expect(shell.match(/text=\{parentText\}/g)).toHaveLength(2);
  });
});
