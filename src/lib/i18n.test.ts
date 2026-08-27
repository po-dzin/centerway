/**
 * The locale guard.
 *
 * Two locales ship, and only two: `uk` and `en`. The panel used to carry a `ru`
 * dictionary and no `uk` one at all, while the content schema was uk-first —
 * the two halves of the product disagreed about what language it speaks. That
 * is closed; these tests are what keeps it closed.
 *
 * The key-parity check matters more than it looks: `TranslationKey` is derived
 * from `translations.en`, so a key added to `en` alone still typechecks
 * everywhere and simply renders `undefined` on the Ukrainian panel. Only a test
 * can catch that.
 */

import { describe, expect, it } from "vitest";

import { translations, type Lang } from "./i18n";
import { getAdminLocale } from "./adminLocale";

const LOCALES: Lang[] = ["uk", "en"];

describe("admin translations", () => {
  it("ships exactly the two locales", () => {
    expect(Object.keys(translations).sort()).toEqual([...LOCALES].sort());
  });

  it("carries the same keys in both", () => {
    const uk = Object.keys(translations.uk).sort();
    const en = Object.keys(translations.en).sort();
    expect(uk).toEqual(en);
  });

  it("leaves no key empty", () => {
    for (const locale of LOCALES) {
      const empty = Object.entries(translations[locale])
        .filter(([, value]) => typeof value !== "string" || value.trim() === "")
        .map(([key]) => key);
      expect(empty).toEqual([]);
    }
  });

  /* Russian is gone from the interface, not merely unselectable: a leftover
     string would sit in the panel until a reader hit that exact screen. The
     four letters below exist in Russian and not in Ukrainian, so one of them
     appearing in the `uk` dictionary means the row was never translated. */
  it("has no untranslated Russian left in the uk dictionary", () => {
    const russianOnly = /[ыэъё]/i;
    const stragglers = Object.entries(translations.uk)
      .filter(([, value]) => russianOnly.test(value))
      .map(([key]) => key);
    expect(stragglers).toEqual([]);
  });
});

describe("getAdminLocale", () => {
  it("formats dates and numbers per locale", () => {
    expect(getAdminLocale("uk")).toBe("uk-UA");
    expect(getAdminLocale("en")).toBe("en-US");
  });

  it("falls back to Ukrainian, not English, for anything unknown", () => {
    expect(getAdminLocale("ru")).toBe("uk-UA");
    expect(getAdminLocale("")).toBe("uk-UA");
  });
});
