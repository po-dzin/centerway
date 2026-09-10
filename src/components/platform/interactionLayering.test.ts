import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../../..");
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");
const css = read("src/app/globals.css").replace(/\/\*[\s\S]*?\*\//g, "");

const rule = (selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\}`, "m").exec(css)?.[1] ?? "";
};

describe("platform interaction layers", () => {
  it("uses ink, not a material plate, for navigation hover and current state", () => {
    for (const selector of [".cw-tab:hover", ".cw-tab-active", ".cw-nav-link:hover", ".cw-nav-link-active"]) {
      const declarations = rule(selector);
      expect(declarations).toBeTruthy();
      expect(declarations).not.toMatch(/background|border-color|box-shadow|translateY/);
    }

    expect(css).toContain(".cw-ink-label-mark");
    expect(css).toContain(".cw-ink-icon-mark");
    expect(css).toContain('[aria-pressed="true"]');
    expect(css).toContain('[aria-current="page"]');
  });

  it("keeps material hover only for physical rows and cards", () => {
    expect(rule(".cw-list-item:hover")).toContain("--cw-mat-hover-bg");
    expect(rule(".cw-row-hover:hover")).toContain("--cw-mat-hover-bg");
    expect(rule(".cw-page-btn:hover")).not.toContain("background");
  });

  it("keeps native text selection out of controls without blocking reading or editing", () => {
    expect(css).toContain("user-select: none");
    expect(css).toContain('[role="menuitemcheckbox"]');
    expect(css).toContain('input:not([type="checkbox"]):not([type="radio"])');
    expect(css).toContain("user-select: text");
  });

  it("keeps the resting stroke to links in running copy and the one aggregate crossing", () => {
    /* The `link` variant draws its stroke before anyone touches it, which is
       the affordance a link needs when nothing else marks it out — inside a
       sentence, or standing alone beside a heading on a touch screen where
       there is no hover to reveal anything.

       `PlatformBlockLink` JOINED THIS LIST ON 2026-09-06, and the count below
       is the point of the test rather than an exception to it. The crossing to
       an aggregate page had grown three shapes — this component in block heads,
       a hand-rolled copy in the carousel's footer, another in the cabinet — and
       collapsing them onto one component meant choosing one resting state for
       all three. It is the visible stroke: the arrow beside the label is a 12px
       glyph, which is not an affordance on its own, and the hover that used to
       carry the mark does not exist on a phone.

       What the loop still guards is that the strength stays a DECISION. Every
       other consumer of a row of ways out — the footer's link row, a nav, a set
       of tabs — is already marked out by being a row, and takes the navigation
       strength: invisible at rest, ink on hover. */
    expect(css).toContain('.cw-ink-label[data-cw-ink-variant="link"] .cw-ink-label-mark');

    for (const [rel, allowed] of [
      // One survivor inside a sentence: «якщо ви знайшли помилку — …».
      ["src/components/platform/layout/PlatformFooter.tsx", 1],
      // The aggregate crossing — one component, every surface.
      ["src/components/platform/PlatformBlock.tsx", 1],
      ["src/components/platform/PlatformOfferCarousel.tsx", 0],
      ["src/components/platform/blocks/orientation/hub.tsx", 0],
    ] as const) {
      const source = read(rel);
      const restingLinks = source.match(/InteractionInkLabel variant="link"/g) ?? [];
      expect(restingLinks.length, `${rel} uses the resting stroke ${restingLinks.length} time(s)`).toBe(allowed);
    }

    /* The rail reports its position and nothing else: the way out moved to the
       section head, so the carousel must not grow a second one back. It has no
       destination of its own, which is why it imports no link at all. */
    const carousel = read("src/components/platform/PlatformOfferCarousel.tsx");
    expect(carousel).not.toMatch(/from "next\/link"/);
    expect(carousel).not.toMatch(/viewAllHref[?:]/);
  });

  it("moves every shared admin navigation consumer onto the ink primitives", () => {
    const tabs = read("src/components/admin/AdminTabs.tsx");
    const layout = read("src/app/(platform)/admin/AdminShell.tsx");
    const pagination = read("src/components/admin/AdminPagination.tsx");

    expect(tabs).toContain("InteractionInkLabel");
    expect(tabs).toContain("aria-pressed=");
    expect(layout).toContain("InteractionInkLabel");
    expect(layout).toContain("InteractionInkIcon");
    expect(layout).toContain("aria-current=");
    expect(pagination).toContain("InteractionInkIcon");
  });

  it("uses the account-menu ink variant for selected labels in compound controls", () => {
    const accountMenu = read("src/components/platform/layout/PlatformAccountMenu.tsx");
    const shelfFilter = read("src/components/platform/cabinet/ShelfFilter.tsx");
    const shelfCss = read("src/components/platform/cabinet/ShelfFilter.module.css");

    expect(css).toContain('[data-cw-ink-variant="menu"]');
    expect(accountMenu).toContain('InteractionInkLabel variant="menu"');
    expect(shelfFilter).toContain('InteractionInkLabel variant="menu" active={query.categories.includes(one)}');
    expect(shelfCss).not.toContain("cw-ink-label-mark");
  });

  it("holds the public catalogue filter to the shelf's recipe rather than a second copy", () => {
    const filter = read("src/components/platform/PlatformCatalogFilter.tsx");
    const filterCss = read("src/components/platform/PlatformCatalogFilter.module.css");

    // Every selected option is the canonical compound-control gesture: kinds,
    // subjects and the free switch alike.
    expect(filter).toContain('InteractionInkLabel variant="menu" active={query.kinds.includes(kind)}');
    expect(filter).toContain('InteractionInkLabel variant="menu" active={query.categories.includes(category)}');
    expect(filter).toContain('InteractionInkLabel variant="menu" active={query.freeOnly}');
    expect(filterCss).not.toContain("cw-ink-label-mark");

    // The bounded control recipes are composed from the shelf, not restated —
    // one edge, one counter, one popover across both surfaces.
    for (const recipe of ["find", "filterToggle", "filterCount", "filterPopover", "filterCheckbox"]) {
      expect(filterCss).toContain(`composes: ${recipe} from "./cabinet/ShelfFilter.module.css";`);
    }
  });

  it("keeps both shelves on the same post-filter and presentation primitives", () => {
    const library = read("src/components/platform/cabinet/LearnShelfClient.tsx");
    const workshop = read("src/components/builder/BuilderCourseList.tsx");
    const presentation = read("src/components/platform/cabinet/ShelfPresentation.tsx");
    const presentationCss = read("src/components/platform/cabinet/ShelfPresentation.module.css");
    const filterCss = read("src/components/platform/cabinet/ShelfFilter.module.css");

    expect(library).toContain("<ShelfResultBar");
    expect(library).toContain("<ShelfPresentation");
    expect(library).toContain("cab.materialsCount(shelf.length)");
    expect(workshop).toContain('title="Матеріали"');
    expect(workshop).toContain("lead=\"Створюйте, редагуйте та публікуйте навчальні матеріали.\"");
    expect(workshop).toContain("<ShelfResultBar");
    expect(workshop).toContain("<ShelfPresentation");
    expect(presentation).toContain("InteractionInkIcon");
    expect(presentationCss).toContain("border-image: var(--cw-rule-fade-x)");
    const filterToggle = /\.filterToggle\s*\{([\s\S]*?)\n\}/.exec(filterCss)?.[1] ?? "";
    expect(filterToggle).toContain('composes: secondary from "../PlatformButtons.module.css";');
    expect(filterToggle).toContain('composes: hug from "../PlatformButtons.module.css";');
    expect(filterToggle).not.toContain("cw-ink-icon");
    expect(filterCss).toContain("flex: 0 0 1.15rem;");
  });

  it("keeps loading title-free and starts the learner breadcrumb beside the wordmark", () => {
    const library = read("src/components/platform/cabinet/LearnShelfClient.tsx");
    const courseTrailCss = read("src/components/lms/Lms.module.css");

    const loadingBlock = /const shelfLoading\s*=\s*\(([\s\S]*?)\n\s*\);/.exec(library)?.[1] ?? "";
    expect(loadingBlock).toContain("<PlatformLoadingState");
    expect(loadingBlock).not.toContain("<PlatformPageHead");
    const courseTrail = /\.courseTopbarTrail\s*\{([^}]*)\}/.exec(courseTrailCss)?.[1] ?? "";
    expect(courseTrail).not.toContain("margin-inline: auto");
  });

  it("shares the workspace header with the Builder while keeping admin navigation route-local", () => {
    const layout = read("src/app/(platform)/admin/AdminShell.tsx");
    const rail = read("src/app/(platform)/admin/AdminLayout.module.css");
    const workspaceTokens = read("src/app/globals.css");

    expect(layout).toContain('<PlatformHeader');
    expect(layout).toContain('surface="personal"');
    expect(layout).toContain('mode="workspace"');
    expect(layout).not.toContain("workspaceMobileContent");
    expect(layout).toContain('name={expanded ? "arrow-left" : "arrow-right"}');
    expect(layout).not.toContain("LanguageSwitcher");
    expect(rail).toContain("var(--cw-workspace-side-panel-width)");
    expect(rail).toContain("var(--cw-rule-fade-y)");
    expect(rail).toContain("var(--cw-rule-fade-x)");
    expect(rail).toContain("var(--cw-workspace-panel-motion)");
    expect(workspaceTokens).toContain("--cw-workspace-side-panel-width");
  });

  it("gives every legacy icon-only utility a drawn ring", () => {
    const tsxFiles = fs
      .readdirSync(path.join(root, "src"), { recursive: true })
      .filter((entry): entry is string => typeof entry === "string" && entry.endsWith(".tsx"));
    const missing: string[] = [];

    for (const rel of tsxFiles) {
      const source = read(`src/${rel}`);
      for (const match of source.matchAll(/className=(?:"[^"]*cw-icon-btn[^"]*"|\{`[^`]*cw-icon-btn[^`]*`\})/g)) {
        const nearby = source.slice(match.index, match.index + 420);
        if (!nearby.includes("<InteractionInkIcon")) missing.push(rel);
      }
    }

    expect(missing).toEqual([]);
  });
});
