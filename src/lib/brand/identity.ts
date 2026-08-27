/**
 * The brand, stated once, in the form machines read.
 *
 * WHY THIS FILE EXISTS. Until now "what CenterWay is" was written thirty times:
 * once per `export const metadata` block, each in a slightly different voice,
 * plus "Unified platform for CenterWay products" in the root layout — English,
 * internal, and the fallback description for every page that forgot its own.
 * A search engine reading thirty answers to one question picks one; an answer
 * engine quoting a page needs the answer to be the same wherever it lands.
 *
 * THE NEW FORMAT. Every public description on the platform is built from four
 * parts, in this order: WHAT it is · FOR WHOM · WHAT IS INSIDE · WHERE THE
 * METHOD STOPS. The last one is not decoration — the claims matrix in the
 * brand contract forbids medical promises, and a description that omits the
 * boundary is the one an answer engine will quote without it.
 *
 * WHAT READS THIS. Page metadata (`src/lib/seo/metadata.ts`), the structured
 * data in `src/lib/seo/jsonLd.ts`, and `/llms.txt`. Change the positioning
 * here and all three move together.
 */

import { socialLinks, contact } from "@/lib/platform/content";
import { PLATFORM_ORIGIN } from "@/lib/surfaces/catalog";

/** The mark and wordmark on the deep ground — baked by scripts/brand-mark-bake.mjs. */
export const BRAND_COVER = "/cw/brand/cw-og-cover.png";

/** The language the public surface is written in. */
export const BRAND_LOCALE = "uk_UA";

export const BRAND = {
  name: "CenterWay",
  origin: PLATFORM_ORIGIN,

  /**
   * The category, in the words someone would use to search for it. Not a
   * slogan: a slogan answers "why", and every engine here is asking "what".
   *
   * IT IS NO LONGER "аюрведична платформа". That line described the platform of
   * the funnel era, when the thing sold was a method and the thing delivered
   * was a Telegram bot. What is sold now is a PROGRAMME someone passes: lessons
   * with progress, an access window, a cabinet, practice and live support —
   * composed of parts of different kinds (course + consultation + support +
   * herbs), which is exactly what the Experience decision in
   * docs/ontology-sync-2026-08-26.md names. Ayurveda stayed where it belongs:
   * it is the METHOD the programmes lean on, stated in `summary`, not the
   * category the platform is.
   *
   * "КУРОВАНА" IS NOT AN ORNAMENT. The semiotic passport puts it plainly:
   * CenterWay does not sell content, it organises НАВІГАЦІЮ ДО СТАНУ — a
   * curated path from scatteredness to support, clarity and attentive
   * presence. A platform where anyone uploads anything is a library; this one
   * is assembled, and the word says so before the visitor has to guess.
   */
  category: "Курована платформа цілісного відновлення",

  /** The line under the name. Human first, indexable second. */
  tagline: "Тіло · Ритм · Опора",

  /**
   * The meta description of the platform itself — the default for any page
   * that has not written its own, and the sentence quoted when nothing more
   * specific matches. Kept inside ~160 characters on purpose.
   */
  description:
    "CenterWay — курована платформа цілісного відновлення: тіло, харчування, ритм і практика зібрані в один шлях, із супроводом до стану уважної присутності. Без медичних обіцянок.",

  /**
   * The long form: what an answer engine is given when it asks the platform to
   * describe itself, and what `/llms.txt` opens with. Four sentences, one per
   * part of the format.
   */
  summary: [
    "CenterWay — курована платформа цілісного відновлення: не бібліотека відео і не набір порад, а зібраний шлях від розсіяності до опори, ясності та стану уважної присутності. Курс, тілесна практика, харчування, ритм дня і живий супровід зібрані в одну програму і в один кабінет.",
    "Для дорослих у перевантаженому ритмі, які хочуть повернути травлення, сон і енергію послідовно, а не окремими порадами.",
    "Усередині: безкоштовний тест доші; програми — детокс «Шлях 21», розвантажувальний день, відновлююча гімнастика IREM, харчування під конституцію; персональна консультація і трав'яна підтримка. Куплене відкривається в особистому кабінеті: уроки у своєму темпі, зрозумілий термін доступу і супровід.",
    "Метод спирається на аюрведу, дієтологію і роботу з тілом. CenterWay не ставить діагнозів, не лікує захворювань і не замінює лікаря — робота йде з харчуванням, ритмом дня і практикою.",
  ],

  /**
   * WHAT IS DELIBERATELY NOT CLAIMED HERE: the builder. It is internal tooling
   * — access is granted by hand and creator self-service is not planned
   * (creator-contract §1, meta-audit §6.2) — so "конструктор курсів для
   * авторів" in a public description would advertise a door that does not open.
   *
   * The entities the platform wants to be recognised BY. Not a keyword stuffing
   * list — the terms below are the ones the pages actually earn: each has a
   * surface answering it.
   */
  entities: [
    "цілісне відновлення",
    "програма відновлення",
    "відновлення енергії",
    "тест доші",
    "детокс-програма",
    "відновлення травлення",
    "ритм дня",
    "аюрведа",
    "аюрведична консультація",
    "трав'яна підтримка",
    "відновлююча гімнастика",
  ],

  /** Where the method stops, in full — for structured data and /llms.txt. */
  boundary:
    "CenterWay не ставить діагнозів, не лікує захворювань і не замінює консультацію лікаря.",

  /**
   * The same boundary at meta-description length. A description has ~160
   * characters before it is cut, and a clause that is always cut protects
   * nobody — so the short form is what pages carry and the full sentence is
   * what the structured data and /llms.txt carry.
   */
  boundaryShort: "Без медичних обіцянок.",

  founder: {
    name: "Євгеній Корякін",
    jobTitle: "Дослідник і практик аюрведи, магістр комплементарної медицини",
    description:
      "Засновник CenterWay. Аюрведа, дієтологія, детоксикація, йога і комплементарна медицина — практика з людьми, а не лікування.",
    /* The founder's page IS /consult since the 2026-08-23 merge — `personLd`
       builds the Person's `url` from this, and pointing it at a 308 would make
       every structured-data node on the site cite a redirect. */
    path: "/consult",
  },

  contact,

  /** The accounts that are the same brand elsewhere — `sameAs` in structured data. */
  sameAs: socialLinks.map((link) => link.href),
} as const;

/** The platform's own description, as one paragraph. */
export function brandSummary(): string {
  return BRAND.summary.join(" ");
}

/**
 * A page description in the new format.
 *
 * `what` carries the first three parts and the boundary is appended, because a
 * description that runs out of room drops the boundary last, not first. Callers
 * that genuinely have no health claim to bound — legal pages, the payment
 * return — pass `{ bounded: false }`.
 */
export function describe(what: string, options?: { bounded?: boolean }): string {
  const bounded = options?.bounded ?? true;
  const text = what.trim();
  if (!bounded) return text;
  return `${text} ${BRAND.boundaryShort}`;
}
