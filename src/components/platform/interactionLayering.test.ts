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

  it("shares the workspace header with the Builder while keeping admin navigation route-local", () => {
    const header = read("src/components/platform/layout/PlatformHeader.tsx");
    const layout = read("src/app/(platform)/admin/layout.tsx");

    expect(header).toContain("workspaceMobileContent");
    expect(layout).toContain('<PlatformHeader');
    expect(layout).toContain('surface="personal"');
    expect(layout).toContain('mode="workspace"');
    expect(layout).toContain("workspaceMobileContent={(closeMenu)");
    expect(layout).toContain('name={expanded ? "arrow-up" : "arrow-down"}');
    expect(layout).not.toContain("LanguageSwitcher");
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
