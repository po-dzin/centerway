/**
 * The admin panel's dictionary.
 *
 * ONE STRING, BOTH LANGUAGES, ONE LINE. The panel used to keep a `uk` object
 * and an `en` object 690 lines apart, and the shape had a hole its own test
 * described: `TranslationKey` is derived from the dictionary, so a key added to
 * one locale alone typechecked everywhere and rendered `undefined` on the other
 * panel — only a test could catch it. Paired entries close that by
 * construction: there is no way to write half a string. They also put the
 * translation where whoever writes it needs it, next to the original.
 *
 * Areas are files (`./i18n/orders.ts` and friends), so a tab's strings are
 * found by name rather than by scrolling, and two people working on two tabs
 * are no longer editing the same 1 375 lines.
 *
 * This dictionary is the ADMIN's, and only the admin's — see
 * `docs/adr/0005-the-admin-is-keyed-the-public-surface-is-not.md` for why the
 * public surface writes its Ukrainian in place instead.
 */

import { access } from "./i18n/access";
import { analytics } from "./i18n/analytics";
import { audit } from "./i18n/audit";
import { auth } from "./i18n/auth";
import { customers } from "./i18n/customers";
import { jobs } from "./i18n/jobs";
import { layout } from "./i18n/layout";
import { orders } from "./i18n/orders";
import { system } from "./i18n/system";

export type Lang = "uk" | "en";

const entries = {
  ...layout,
  ...auth,
  ...audit,
  ...analytics,
  ...system,
  ...orders,
  ...jobs,
  ...customers,
  ...access,
};

export type TranslationKey = keyof typeof entries;

function locale(lang: Lang): Record<TranslationKey, string> {
  const out = {} as Record<TranslationKey, string>;
  for (const [key, pair] of Object.entries(entries) as [TranslationKey, { uk: string; en: string }][]) {
    out[key] = pair[lang];
  }
  return out;
}

export const translations: Record<Lang, Record<TranslationKey, string>> = {
  uk: locale("uk"),
  en: locale("en"),
};
