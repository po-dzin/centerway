import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../../..");

/**
 * ONE CALENDAR, NEVER THE BROWSER'S (G, 2026-10-06).
 *
 * A native date or time field opens a picker the browser draws in its own
 * colours and with its own first day of the week: a light-grey Chrome popup on
 * a dark panel. The builder's «Діє до» and «Старт потоку» still opened it after
 * the admin had moved to `AdminDateField`. Every date is picked in that field
 * (or, for a span, in the analytics `DateRangePicker`, which draws the same
 * calendar from `AdminCalendar.module.css`).
 */
describe("every date is picked in the design system's calendar", () => {
  const sources = (function walk(dir: string): string[] {
    return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) return walk(rel);
      return /\.tsx$/.test(entry.name) && !/\.test\.tsx$/.test(entry.name) ? [rel] : [];
    });
  })("src");

  it("has no native date, time or datetime-local field", () => {
    const native = /type=\{?["'](date|time|datetime-local|month|week)["']\}?/;
    // Comments may name the native field (AdminDateField explains why it is not one).
    const code = (rel: string) =>
      fs
        .readFileSync(path.join(root, rel), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
    const offenders = sources.filter((rel) => native.test(code(rel)));
    expect(offenders).toEqual([]);
  });
});
