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

  it("moves every shared admin navigation consumer onto the ink primitives", () => {
    const tabs = read("src/components/admin/AdminTabs.tsx");
    const layout = read("src/app/(platform)/admin/layout.tsx");
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
    const layout = read("src/app/(platform)/admin/layout.tsx");
    const rail = read("src/app/(platform)/admin/AdminLayout.module.css");
    const workspaceTokens = read("src/app/globals.css");

    expect(layout).toContain('<PlatformHeader');
    expect(layout).toContain('surface="personal"');
    expect(layout).toContain('mode="workspace"');
    expect(layout).not.toContain("workspaceMobileContent");
    expect(layout).toContain('name={expanded ? "arrow-up" : "arrow-down"}');
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
