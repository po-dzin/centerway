import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.resolve(__dirname, "../../..", file), "utf8");
/** The declarations of one rule, found by its literal selector. */
const rule = (source: string, selector: string) => {
  const at = source.indexOf(`${selector} {`);
  if (at < 0) return "";
  return source.slice(at + selector.length + 2, source.indexOf("}", at));
};

/**
 * ONE CHROME GRAMMAR ON THE PHONE, across the reader, the library and the
 * workshop: the leading island is the way out of THIS level, the trailing
 * capsule holds the document's own controls, and a panel opens over the
 * document instead of pushing it off the screen.
 *
 * These are the three ways the workshop broke that grammar before 2026-09-06,
 * each of which looked like a small local choice in its own file.
 */
describe("workshop chrome on a phone", () => {
  const shell = read("src/components/builder/BuilderShell.tsx");
  const css = read("src/components/builder/Builder.module.css");

  it("leaves the level, not the application: an arrow one level in, the mark at the root", () => {
    expect(shell).toContain("PlatformBackOrgan");
    // Derived from the trail, so no surface can forget to pass it — and from
    // the nearest step that actually leads somewhere, because a lesson's parent
    // in the path is its module, which has no page of its own.
    expect(shell).toContain(".find((step) => step.onNavigate || step.href) ?? null;");
    expect(shell).toContain("<PlatformMarkOrgan />");
  });

  it("prints no breadcrumb in the document, where the arrow already says it", () => {
    expect(shell).not.toContain("<PlatformTrail steps={trail} />\n              {tools");
    // The path survives in the wide bar, which has room for one.
    expect(shell).toContain("{showTrail ? <PlatformTrail steps={trail} /> : <span />}");
  });

  it("opens the contents over the lesson, not above it", () => {
    const open = rule(css, ".aside[data-open]");
    expect(open).toContain("position: fixed");
    expect(open).toContain("var(--cw-overlay)");
    /* THE SHEET IS THE PLATFORM'S (2026-09-06). It was written here from the
       reader's values because `composes` cannot be scoped to a media query and
       this element is a rail above 901px; the material sits on a wrapper now,
       and the wrapper is `display: contents` where the rail lives. The contract
       keeps both halves: that the workshop composes the recipe, and that the
       recipe still carries the ceiling and the elevation this guarded. */
    expect(rule(css, ".asideSheet")).toContain('composes: sheet from "../platform/layout/BottomSheet.module.css"');
    const recipe = read("src/components/platform/layout/BottomSheet.module.css");
    expect(rule(recipe, ".sheet")).toContain("82svh");
    expect(rule(recipe, ".sheet")).toContain("var(--cw-mat-shadow-deep)");
    // A modal is dismissed by the page behind it.
    expect(shell).toContain("asideScrim");
  });

  it("keeps the block tools in the chrome capsule, not in a second floating strip", () => {
    expect(rule(css, ".toolModeRail")).toContain("display: none");
    // One opener in the capsule; its three modes live in the sheet's own head,
    // because five islands do not fit across a 375px row above the touch floor.
    expect(read("src/components/builder/BuilderLessonEditor.tsx")).toContain("<BuilderToolsOrgan");
    expect(read("src/components/builder/BuilderToolRail.tsx")).toContain(
      "<BuilderToolTabs mode={mode} open={open} onMode={onMode} />",
    );
  });

  it("dresses the capsule's members as one object", () => {
    const organs = read("src/components/platform/layout/ChromeOrgans.module.css");
    expect(rule(organs, ".cluster > :is(button, a)")).toContain("box-shadow: none");
  });
});

/**
 * THE RIGHT DRAWER IS A DRAWER (2026-09-20).
 *
 * Twice now this panel has been written as a modal with a drawer's silhouette,
 * and both faults were invisible in a screenshot of the panel itself — they
 * were only visible in what the panel did to everything else on the screen.
 */
describe("the version-history drawer", () => {
  const css = read("src/components/builder/Builder.module.css");
  const sheet = read("src/components/builder/BuilderSheet.tsx");

  it("leaves the course beside it usable", () => {
    // Non-modal above the phone band: `show()`, not `showModal()`. An author
    // opens the history to read it against the document it describes.
    expect(sheet).toContain("dialog.show()");
    expect(sheet).toContain('placement === "side" && window.matchMedia(DRAWER_FROM).matches');
    // And the phone's full-screen bottom sheet, where there is no «beside»,
    // keeps the focus trap it earns.
    expect(sheet).toContain("dialog.showModal()");
    // `cancel` never fires for a non-modal dialog, so Escape is listened for —
    // once, and never for the modal half as well.
    expect(sheet).toContain('ref.current.matches(":modal")');
  });

  it("starts below the topbar's line rather than on top of it", () => {
    // The bar's contour is the chrome ring, which paints outside its box: the
    // drawer has to clear the height AND that pixel.
    expect(rule(css, ".shell")).toContain("--builder-drawer-top: var(--builder-topbar-height)");
    expect(css).toContain("--builder-drawer-top: calc(var(--builder-topbar-height) + 1px)");
    const side = rule(css, ".sheetSide");
    expect(side).toContain("position: fixed");
    expect(side).toContain("inset-block: var(--builder-drawer-top) 0");
    // Placed by its insets, because an auto margin only reaches the right edge
    // while the dialog is modal.
    expect(side).toContain("margin: 0");
  });

  it("dims nothing", () => {
    expect(rule(css, ".sheetSide::backdrop")).toContain("background: transparent");
  });
});
