import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
const read = (file: string) => fs.readFileSync(path.resolve(__dirname, "../..", file), "utf8");

describe("one notification contract for four application surfaces", () => {
  it("mounts once per app root, not within the admin layout or funnels", () => {
    for (const root of ["platform", "builder"]) {
      expect(read(`src/app/(${root})/layout.tsx`)).toContain("<ToastProvider>{children}</ToastProvider>");
    }
    expect(read("src/app/(platform)/admin/layout.tsx")).not.toContain("ToastProvider");
    expect(read("src/app/(funnels)/layout.tsx")).not.toContain("ToastProvider");
  });
  it("removes transient paragraphs without removing contextual import validation", () => {
    for (const name of ["BuilderCourseList", "BuilderCourseView", "BuilderLessonEditor", "BuilderVersionHistory"]) {
      const source = read(`src/components/builder/${name}.tsx`);
      expect(source).toContain("useToast()");
      expect(source).not.toMatch(/\[note, setNote\]|\[message, setMessage\]|\{note \? <p/);
    }
    expect(read("src/components/builder/BuilderCourseList.tsx")).toContain('className={styles.noticeLine} role="alert"');
  });
  it("uses fixed token-based geometry, semantic announcements and the shared close glyph", () => {
    const css = read("src/components/ToastProvider.module.css");
    const source = read("src/components/ToastProvider.tsx");
    expect(css).toContain("position: fixed");
    expect(css).toContain("var(--ds-z-modal)");
    expect(css).toContain("env(safe-area-inset-right)");
    expect(css).toContain("prefers-reduced-motion");
    for (const tone of ["success", "failed", "running", "pending"]) expect(css).toContain(`--cw-status-${tone}`);
    expect(source).toContain('item.variant === "error" ? "alert" : "status"');
    expect(source).toContain('<Icon name="close"');
    expect(source).not.toContain("<path");
  });
  it("ships menu icons in both deterministic sprites and the typed registry", () => {
    const menu = read("src/components/builder/BuilderCourseList.tsx");
    for (const name of ["export", "unpublish"]) {
      expect(menu).toContain(`icon: "${name}"`);
      expect(read("src/components/iconNames.ts")).toContain(`"${name}"`);
      for (const sprite of ["public/cw/icons/cw-icons.svg", "src/landing-static/shared/img/cw-icons.svg"]) {
        expect(read(sprite)).toContain(`id="cw-${name}"`);
      }
    }
  });
});
