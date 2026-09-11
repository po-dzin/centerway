import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.resolve(__dirname, "../../..", file), "utf8");

/**
 * ONE FRAME FOR A FACE.
 *
 * The same object was declared five times — the shell's account avatar, the
 * offer byline, the author page, the workshop preview, the crop editor — with
 * five sizes, four radii and two empty states, while the hard half (the crop
 * math) was already shared. The cost showed the first time the shape changed:
 * portraits left the circle on 2026-09-06 in four separate edits, one frame was
 * missed and stayed a circle, and the crop editor's own caption still said
 * «Кругла аватарка» a day later.
 *
 * These assertions are the three ways that came back.
 */
describe("author portrait", () => {
  const surfaces = [
    "src/components/platform/OfferFacets.tsx",
    "src/components/platform/AuthorProfileShowcase.tsx",
    "src/components/builder/BuilderCourseAuthor.tsx",
  ];

  it("is drawn by one component on every surface that shows a face", () => {
    for (const file of surfaces) {
      const source = read(file);
      expect(source).toContain("<AuthorPortrait");
      // The frame owns the crop; a surface reaching for it again is a surface
      // rebuilding the portrait around it.
      expect(source).not.toContain("authorAvatarCropStyle");
    }
  });

  it("leaves no second frame behind in the surfaces' own stylesheets", () => {
    const dead = ["authorPhotoFrame", "portraitFrame", "portraitFallback", "authorPreviewPhotoFrame"];
    const sheets = [
      "src/components/platform/PlatformOfferCommerce.module.css",
      "src/components/platform/AuthorProfileShowcase.module.css",
      "src/components/builder/Builder.module.css",
    ];
    for (const sheet of sheets) {
      const css = read(sheet);
      for (const name of dead) expect(css).not.toContain(`.${name} {`);
    }
  });

  /* A FACE IS ROUND, and the shape is not a caller's choice: the radius travels
     with the size step, so a page picks how big the portrait is and never what
     shape it is. The chrome's CONTROLS are the soft rect — that is a different
     object with a different rule. */
  it("draws a face round, at every size, without the caller saying so", () => {
    const css = read("src/components/platform/AuthorPortrait.module.css");
    for (const step of [".sm {", ".md {", ".lg {"]) {
      const rule = css.slice(css.indexOf(step), css.indexOf("}", css.indexOf(step)));
      expect(rule).toContain("--portrait-size");
      expect(rule).toContain("--portrait-radius: var(--cw-radius-pill)");
    }
  });

  /* AND THE CHROME'S FACES OBEY THE SAME RULE (2026-09-07). The claim above —
     «a face is round» — was true of this component and of nothing else: the
     bar's avatar had been rewritten to the control step on the reading that a
     portrait inside a control takes the control's corner, and the cabinet's
     hero face stayed round beside it. One object, three answers, and no test
     that could see more than one of them. The decision is product-wide now, so
     the contract is too: the PLATE a face sits in is a soft rect and takes its
     box's step; the face inside it is round. */
  it("draws every chrome face round too, not just the component's", () => {
    const shell = read("src/components/platform/PlatformShell.module.css");
    const bar = shell.slice(
      shell.indexOf("\n.profileAvatar {"),
      shell.indexOf("}", shell.indexOf("\n.profileAvatar {")),
    );
    expect(bar).toContain("border-radius: var(--cw-radius-pill)");

    const island = shell.slice(shell.indexOf('[data-cw-chrome="organs"] .profileAvatar {'));
    expect(island.slice(0, island.indexOf("}"))).toContain("border-radius: var(--cw-radius-pill)");

    const hero = read("src/components/platform/cabinet/CabinetHero.module.css");
    const face = hero.slice(hero.indexOf("\n.avatar {"), hero.indexOf("}", hero.indexOf("\n.avatar {")));
    expect(face).toContain("border-radius: var(--cw-radius-pill)");
  });

  it("previews that same shape in the crop editor", () => {
    const css = read("src/components/platform/cabinet/Cabinet.module.css");
    // The bare selector, not `.photoCropAside > .photoCropAvatar` which sits
    // above it and only places the frame in its row.
    const at = css.indexOf("\n.photoCropAvatar {");
    const rule = css.slice(at, css.indexOf("}", at));
    expect(rule).toContain("var(--cw-radius-pill)");
  });

  it("does not name the shape in the crop editor's copy", () => {
    const fold = read("src/components/platform/cabinet/AuthorProfileFold.tsx");
    expect(fold).not.toContain('photoCropAvatarTitle: "Кругла');
    expect(fold).not.toContain('photoCropAvatarTitle: "Round');
  });
});
