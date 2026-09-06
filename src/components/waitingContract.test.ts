import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => fs.readFileSync(path.resolve(__dirname, "../..", file), "utf8");

/**
 * ONE WAY TO WAIT, AND ONE WAY TO SAY WHERE THE LAYER IS.
 *
 * Both were the same failure: a primitive the product had already decided on,
 * and two places that had never heard. Waiting was `LogoMark animate="wait"` —
 * «the spinner replacement», in that file's own words — while the admin panel
 * span a Tailwind ring and the diagnostic span a CSS one. Layers were
 * `--ds-z-*` while the auth dialogue used Tailwind's `z-50`, a number from a
 * scale this product does not run, and the floating chrome used a bare `4`.
 */
describe("waiting", () => {
  it("is the mark gaining density, never a rotating ring", () => {
    for (const file of [
      "src/components/admin/AdminLoadingState.tsx",
      "src/components/dosha-test/DoshaTestClient.tsx",
      "src/components/platform/PlatformLoadingState.tsx",
    ]) {
      expect(read(file)).toContain('animate="wait"');
    }
    /* No rotating ring anywhere — the class that drew every one of them. The
       source files above name it only in prose, so the check reads the JSX. */
    const spinning = ["src/components/admin/modals/JobDetailsModal.tsx"];
    for (const file of spinning) expect(read(file)).not.toContain("animate-spin");
    expect(read("src/components/admin/AdminLoadingState.tsx")).not.toContain('className="animate-spin');
    expect(read("src/components/dosha-test/DoshaTestClient.tsx")).not.toContain("diagnosticSpinner");
    // The CSS ring and its keyframes are gone, and so is the reduced-motion
    // rule that existed only to stop it.
    const components = read("src/components/platform/PlatformComponents.module.css");
    expect(components).not.toContain(".diagnosticSpinner {");
    expect(components).not.toContain("diagnosticSpin");
  });

  /* The skeleton is not a second answer: it is the state for a shape already
     known — a table that is about to have rows. The mark is for everything
     whose shape is not known yet. */
  it("keeps the skeleton where the shape of what is coming is known", () => {
    expect(read("src/components/admin/AdminLoadingState.tsx")).toContain("cw-skeleton-row");
  });
});

describe("layers", () => {
  /* The case that found this: a sign-in dialogue painting its shield with
     Tailwind utilities at `z-50` — two orders below the topbar it had to cover.
     It turned out to have no callers at all and was deleted (2026-09-06), so
     the assertion is the general one it was a symptom of: on the platform's own
     surfaces a layer is stated in CSS against `--ds-z-*`, never as a rung from
     a scale this product does not run. */
  it("never states a layer in Tailwind's scale on a platform surface", () => {
    const dirs = ["src/components/platform", "src/components/lms", "src/components/builder", "src/components/dosha-test"];
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(path.resolve(__dirname, "../..", dir), { withFileTypes: true })) {
        const next = `${dir}/${entry.name}`;
        if (entry.isDirectory()) walk(next);
        else if (entry.name.endsWith(".tsx") && /className="[^"]*\bz-\d/.test(read(next))) offenders.push(next);
      }
    };
    for (const dir of dirs) walk(dir);
    expect(offenders).toEqual([]);
  });

  it("puts the floating chrome on the same rung as the bar it replaces", () => {
    const organs = read("src/components/platform/layout/ChromeOrgans.module.css");
    const row = organs.slice(organs.indexOf(".row {"), organs.indexOf("}", organs.indexOf(".row {")));
    expect(row).toContain("z-index: var(--ds-z-sticky)");
    const shell = read("src/components/platform/PlatformShell.module.css");
    const header = shell.slice(shell.indexOf(".header {"), shell.indexOf("}", shell.indexOf(".header {")));
    expect(header).toContain("z-index: var(--ds-z-sticky)");
  });
});
