import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  COURSE_WORKSPACE_HASH,
  DEFAULT_COURSE_WORKSPACE_MODE,
  courseWorkspaceModeFromHash,
} from "./courseWorkspace";

const read = (file: string) => fs.readFileSync(path.resolve(__dirname, "../../..", file), "utf8");
const rule = (source: string, name: string) => new RegExp(`\\.${name}\\s*\\{([^}]+)}`).exec(source)?.[1] ?? "";

describe("Builder course workspace", () => {
  it("opens the cover when no explicit tab is addressed", () => {
    expect(DEFAULT_COURSE_WORKSPACE_MODE).toBe("course");
    expect(courseWorkspaceModeFromHash("")).toBe("course");
    expect(courseWorkspaceModeFromHash("#unknown")).toBe("course");
  });

  it("preserves every explicit tab deep link", () => {
    for (const [mode, hash] of Object.entries(COURSE_WORKSPACE_HASH)) {
      expect(courseWorkspaceModeFromHash(hash)).toBe(mode);
    }
  });

  it("uses the shared presentation switch instead of a loose local ink ring", () => {
    const view = read("src/components/builder/BuilderCourseView.tsx");
    expect(view).toContain("<ShelfPresentation<StructureView>");
    expect(view).toContain('label="Вигляд структури"');
    expect(view).not.toContain('className={styles.viewOption}');
    const css = read("src/components/platform/cabinet/ShelfPresentation.module.css");
    expect(rule(css, "viewOption")).toContain("base chromeBare square");
  });

  it("keeps the Page workspace expanded and unframed", () => {
    const settings = read("src/components/builder/BuilderCourseSettings.tsx");
    const pageBranch = settings.slice(settings.indexOf('if (scope === "page")'), settings.indexOf("/* ──", settings.indexOf('if (scope === "page")')));
    expect(pageBranch).toContain("coursePageForm");
    expect(pageBranch).toContain("courseSettingEditor");
    expect(pageBranch).not.toContain("<SettingsSection");
    expect(pageBranch).not.toContain('name="edit"');

    const view = read("src/components/builder/BuilderCourseView.tsx");
    expect(view).toContain("coursePageSettingsPanel");
    const css = read("src/components/builder/Builder.module.css");
    expect(rule(css, "coursePageSettingsPanel")).not.toContain("border-block-start");
  });
});
