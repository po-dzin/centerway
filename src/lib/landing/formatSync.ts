/**
 * A landing's «Формати участі» follows the program's formats (2026-09-25).
 *
 * The landing is hand-written HTML and its format cards carry copy nobody
 * wants generated — «2 особисті онлайн-консультації з автором». So the cards
 * stay where they are, and the SET is what follows the data:
 *
 *   · a card whose format is on sale stays, and learns what else the format
 *     opens (Reset Day, Short) at the end of its list;
 *   · a format on sale with no card here (the Шлях 21 cohort) gets one, in the
 *     landing's own markup, built from the same row the program page reads;
 *   · a card whose format is no longer on sale is removed.
 *
 * The page opts in with comment markers, which survive any edit to the cards
 * themselves and cost a regex, not a DOM:
 *
 *   <!-- cw:formats way21 -->            the program, by its public address
 *     <!-- cw:format course:way21 --> …card… <!-- /cw:format -->
 *   <!-- /cw:formats -->
 *
 * THE CARD'S PRICE AND ITS DOOR ARE THE FORMAT'S TOO (G, 2026-10-03). A typed
 * card used to keep its typed figure and its typed button: `priceSync` could
 * reprice only a checkout, so an enquiry format's quote never moved, and a
 * format switched between «оплата» and «заявка» in the builder kept the old
 * button on the landing. Now the figure is the format's own `amount`, the
 * price element is keyed by the format's code (so `priceSync` refines a
 * checkout figure from the charged offer, as before), a group's start date
 * replaces the typed note, and the button follows the format's mode.
 *
 * And the page's headline price follows the formats: an element marked
 * `data-cw-price-from="<program>"` prints the lowest price anyone pays
 * («від 3900 грн», `formatFloor` — the catalogue card's and the program page's
 * figure), or the one price when there is only one format.
 *
 * ONE GOLD BUTTON (G, 2026-10-03). The format the owner marked «Бестселер» in
 * the builder wears the gold pill, is marked `data-featured` and keeps
 * `btn-primary`; every other card's button goes `btn-ghost` — all of them when
 * nothing is marked (`featuredFormat`, the program page's rule too). The
 * nearest cohort ahead is named «Найближчий потік» and its note counts the days
 * to its start: information, not the gold.
 *
 * NO FORMATS IS NOT «REMOVE EVERYTHING». An empty list is what a failed read
 * looks like too, so the typed cards stand untouched.
 */

import {
  countdownText,
  daysUntil,
  featuredFormat,
  isPrimaryFormat,
  nearestCohort,
} from "@/lib/experiences/formatFeatured";
import { formatFloor } from "@/lib/experiences/formatFloor";
import { bonusKindLabel } from "@/lib/platform/catalogVocabulary";
import type { BundleHost, ProgramFormat } from "@/lib/experiences/formats";
import { PLATFORM_ORIGIN } from "@/lib/surfaces/catalog";

const BLOCK = /<!--\s*cw:formats\s+([a-z0-9-]+)\s*-->([\s\S]*?)<!--\s*\/cw:formats\s*-->/g;
const CARD = /<!--\s*cw:format\s+([a-z0-9:_-]+)\s*-->([\s\S]*?)<!--\s*\/cw:format\s*-->/g;
const PRICE_FROM = /<(\w+)((?:\s+[^<>]*?)?\sdata-cw-price-from="([a-z0-9-]+)"(?:\s+[^<>]*?)?)>([\s\S]*?)<\/\1>/g;

const ARROW =
  '<span class="arr"><svg class="ico ico-arr" width="18" height="18" aria-hidden="true" focusable="false"><use href="/shared/img/cw-icons.svg#cw-arrow-right"/></svg></span>';

const BADGE: Record<ProgramFormat["format"], string> = {
  self: "Програма",
  group: "Група потоку",
  individual: "Повне занурення",
};

const COHORT_DATE = new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long", timeZone: "UTC" });

function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function includedItems(format: ProgramFormat): string {
  return format.includes
    .map(
      (program) =>
        `<li data-cw-included><span><span class="fc-kind">${bonusKindLabel(program.kind)}</span> ${escape(program.title)}</span></li>`,
    )
    .join("");
}

/** How a card stands in its row: whether it keeps the gold, and today. */
type Standing = { featured: boolean; primary: boolean; nearest: boolean; now: Date };

const BESTSELLER = '<span class="fc-bestseller">Бестселер</span>';

function cohortLine(format: ProgramFormat, now: Date): string | null {
  if (!format.cohortStartsOn) return null;
  const date = new Date(`${format.cohortStartsOn}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  const days = daysUntil(format.cohortStartsOn, now);
  return `старт потоку ${COHORT_DATE.format(date)}${days !== null ? ` · ${countdownText(days)}` : ""}`;
}

function badgeFor(format: ProgramFormat, standing: Standing): string {
  return standing.nearest ? "Найближчий потік" : BADGE[format.format];
}

function priceText(format: ProgramFormat): string {
  return format.amount !== null ? `${format.amount} грн` : "за запитом";
}

/** The card's door: the enquiry form for a lead, the checkout for the rest. */
function actionFor(format: ProgramFormat, primary: boolean): string {
  const role = primary ? "btn-primary" : "btn-ghost";
  return format.mode === "lead"
    ? `<button type="button" class="btn ${role} fc-cta" data-lead-open="${escape(format.code)}">Залишити заявку ${ARROW}</button>`
    : `<a href="#offer" class="btn ${role} fc-cta openModal" data-cta-final data-cw-product="${escape(format.code)}" data-cw-offer-id="${escape(format.code.replace(/[^a-z0-9]+/g, "_"))}" data-cw-price-value="${format.amount ?? 0}">${format.format === "group" ? "Приєднатися до потоку" : "Почати"} ${ARROW}</a>`;
}

/** A card for a format the landing does not have one for, in its own markup. */
export function renderFormatCard(
  format: ProgramFormat,
  programTitle: string,
  standing: Standing = { featured: false, primary: true, nearest: false, now: new Date() },
): string {
  const price = priceText(format);
  const note =
    cohortLine(format, standing.now) ?? (format.mode === "lead" ? "ціну узгоджуємо в розмові" : "повний доступ");
  // The author's list when there is one — the same lines the program page
  // shows; otherwise the one thing certainly true, and the summary.
  const own =
    format.features.length > 0
      ? format.features.map((feature) => `<li>${escape(feature)}</li>`)
      : [`<li>Уся програма «${escape(programTitle)}»</li>`, format.summary ? `<li>${escape(format.summary)}</li>` : ""];
  const features = [...own, includedItems(format)].join("");
  const action = actionFor(format, standing.primary);

  return [
    `<!-- cw:format ${format.code} -->`,
    `<div class="format-card reveal" data-format="${format.format}"${standing.featured ? " data-featured" : ""}>`,
    standing.featured ? BESTSELLER : "",
    `<span class="fc-badge">${badgeFor(format, standing)}</span>`,
    `<div class="fc-title">${escape(programTitle)} — ${escape(format.label.toLowerCase())}</div>`,
    `<div class="fc-price"><b data-cw-price="${escape(format.code)}">${price}</b><small>${escape(note)}</small></div>`,
    `<ul class="fc-features">${features}</ul>`,
    action,
    `</div>`,
    `<!-- /cw:format -->`,
  ].join("\n");
}

/**
 * The card's tone is its format's kind, not its mode (G, 2026-10-03): one
 * scale shared with the program page, keyed by `data-format`. A typed card's
 * older material classes (`self` dark, `premium` light) and the dark-nav flag
 * that went with the dark one are dropped, so a page not yet re-typed still
 * renders the one card.
 */
function toneCard(open: string, format: ProgramFormat, featured: boolean): string {
  const classes = (open.match(/class="([^"]*)"/)?.[1] ?? "format-card")
    .split(/\s+/)
    .filter((name) => name && name !== "self" && name !== "premium")
    .join(" ");
  const rest = open
    .replace(/^<div\b/, "")
    .replace(/>$/, "")
    .replace(/\s*class="[^"]*"/, "")
    .replace(/\s*data-format="[^"]*"/, "")
    .replace(/\s*data-featured(?:="[^"]*")?/, "")
    .replace(/\s*data-cw-nav-dark(?:="[^"]*")?/, "");
  return `<div class="${classes}" data-format="${format.format}"${featured ? " data-featured" : ""}${rest}>`;
}

/**
 * An existing card, brought in line with its format — once, however often it
 * is served.
 *
 * THE LIST FOLLOWS THE DATA WHEN THE DATA HAS ONE (2026-09-25). The card's
 * badge, title, CTA and guarantee line stay as typed: they are the landing's
 * voice. What the buyer GETS is the format's `features` — the list the author
 * edits in the builder and the program page prints — so the landing cannot
 * promise «Усі інструкції трьох тижнів» while the platform promises something
 * else. A format nobody has described keeps the typed list.
 *
 * Either way the bundle's programs close the list, from `includes`.
 */
function syncCard(card: string, format: ProgramFormat, standing: Standing): string {
  const own =
    format.features.length > 0 ? format.features.map((feature) => `<li>${escape(feature)}</li>`).join("") : null;
  let next = card.replace(/<div class="format-card\b[^"]*"[^>]*>/, (open) => toneCard(open, format, standing.featured));
  // The pill is the mark's: dropped, then put back only on the marked card.
  next = next.replace(/\s*<span class="fc-bestseller">[\s\S]*?<\/span>/, "");
  if (standing.featured) next = next.replace(/(<div class="format-card\b[^>]*>)/, `$1${BESTSELLER}`);
  if (standing.nearest) {
    next = next.replace(/(<span class="fc-badge">)[\s\S]*?(<\/span>)/, `$1${badgeFor(format, standing)}$2`);
  }
  next = next.replace(
    /(<div class="fc-price">)([\s\S]*?)(<\/div>)/,
    (_whole, open: string, inner: string, close: string) => {
      const priced = inner.replace(
        /<b\b[^>]*>[\s\S]*?<\/b>/,
        `<b data-cw-price="${escape(format.code)}">${priceText(format)}</b>`,
      );
      const start = cohortLine(format, standing.now);
      return `${open}${start ? priced.replace(/<small>[\s\S]*?<\/small>/, `<small>${escape(start)}</small>`) : priced}${close}`;
    },
  );
  // The door follows the mode; a door already of the right kind keeps its typed words.
  if (format.mode === "lead") {
    next = next.replace(/<a\b[^>]*\bdata-cw-product="[^"]*"[^>]*>[\s\S]*?<\/a>/, actionFor(format, standing.primary));
  } else {
    next = next
      .replace(/<button\b[^>]*\bdata-lead-open="[^"]*"[^>]*>[\s\S]*?<\/button>/, actionFor(format, standing.primary))
      .replace(/(\bdata-cw-price-value=")\d+(")/, `$1${format.amount ?? 0}$2`);
  }
  // …and its paint follows the row: one gold button, the rest secondary.
  next = next.replace(
    /(class="btn )btn-(?:primary|ghost)( fc-cta)/,
    `$1${standing.primary ? "btn-primary" : "btn-ghost"}$2`,
  );
  return next.replace(
    /(<ul class="fc-features">)([\s\S]*?)(<\/ul>)/,
    (_whole, open: string, inner: string, close: string) => {
      const typed = inner.replace(/<li data-cw-included>[\s\S]*?<\/li>/g, "");
      return `${open}${own ?? typed}${includedItems(format)}${close}`;
    },
  );
}

/**
 * Pure: the landing HTML with every marked formats block brought in line with
 * `formatsOf(programSlug)`. `null` from the lookup means «could not read» and
 * leaves that block exactly as typed.
 */
export function applyFormatSync(
  html: string,
  formatsOf: (programSlug: string) => { title: string; formats: ProgramFormat[] } | null,
  now: Date = new Date(),
): string {
  const headline = html.replace(PRICE_FROM, (whole, tag: string, attrs: string, programSlug: string, inner: string) => {
    const formats = formatsOf(programSlug)?.formats ?? [];
    const floor = formatFloor(formats);
    const only = formats.length === 1 && formats[0]!.amount !== null ? formats[0]!.amount : null;
    const figure = floor?.amount ?? only;
    if (figure === null || figure === undefined) return whole;
    const bare = inner.replace(/^(\s*)від\s+/, "$1");
    const priced = bare.replace(/\d+(?:[\s\u00a0\u202f]\d+)*/, String(figure));
    return `<${tag}${attrs}>${floor ? priced.replace(/^(\s*)/, "$1від ") : priced}</${tag}>`;
  });
  return headline.replace(BLOCK, (whole, programSlug: string, inner: string) => {
    const program = formatsOf(programSlug);
    if (!program || program.formats.length === 0) return whole;

    const cards = new Map<string, string>();
    for (const match of inner.matchAll(CARD)) cards.set(match[1]!, match[2]!);

    const featured = featuredFormat(program.formats);
    const cohort = nearestCohort(program.formats, now);
    const body = program.formats
      .map((format) => {
        const standing = {
          featured: featured === format.code,
          primary: isPrimaryFormat(program.formats, format.code),
          nearest: cohort === format.code,
          now,
        };
        const existing = cards.get(format.code);
        return existing !== undefined
          ? `<!-- cw:format ${format.code} -->${syncCard(existing, format, standing)}<!-- /cw:format -->`
          : renderFormatCard(format, program.title, standing);
      })
      .join("\n");
    return `<!-- cw:formats ${programSlug} -->\n${body}\n<!-- /cw:formats -->`;
  });
}

/** The program addresses a page asks formats for. */
export function collectFormatPrograms(html: string): string[] {
  return [
    ...new Set([
      ...[...html.matchAll(BLOCK)].map((match) => match[1]!),
      ...[...html.matchAll(PRICE_FROM)].map((m) => m[3]!),
    ]),
  ];
}

/* ── Bundles, from the included program's side ─────────────────────────────

   A program that other formats open as a bonus says so on its own landing:
   «Розвантажувальний день також входить бонусом у «Шлях 21» — у форматах …».
   The page opts in with a marker where the sentence belongs; what fills it is
   the data, so the day a format stops including the program the sentence goes.

     <!-- cw:bundled-in reset-day --><!-- /cw:bundled-in -->

   The slug is the included program's public address. `null` from the lookup
   (a failed read) leaves whatever is between the markers; `[]` (in no bundle)
   empties it. */

const BUNDLED = /<!--\s*cw:bundled-in\s+([a-z0-9-]+)\s*-->([\s\S]*?)<!--\s*\/cw:bundled-in\s*-->/g;

function joinLabels(labels: string[]): string {
  const quoted = labels.map((label) => `«${escape(label)}»`);
  return quoted.length <= 1 ? (quoted[0] ?? "") : `${quoted.slice(0, -1).join(", ")} і ${quoted.at(-1)}`;
}

/** The sentence for one included program, grouped by the program that hosts it. */
export function renderBundleNote(programTitle: string, hosts: BundleHost[]): string {
  if (hosts.length === 0) return "";
  const byProgram = new Map<string, { title: string; labels: string[] }>();
  for (const host of hosts) {
    const entry = byProgram.get(host.programSlug) ?? { title: host.programTitle, labels: [] };
    entry.labels.push(host.label);
    byProgram.set(host.programSlug, entry);
  }
  const parts = [...byProgram].map(
    ([slug, entry]) =>
      `у <a href="${PLATFORM_ORIGIN}/programs/${escape(slug)}#formats">«${escape(entry.title)}»</a> — ${
        entry.labels.length === 1 ? "у форматі" : "у форматах"
      } ${joinLabels(entry.labels)}`,
  );
  return `<p class="bundle-note" data-cw-bundled-in>${escape(programTitle)} також входить бонусом ${parts.join("; ")}.</p>`;
}

/** Pure: every bundled-in marker filled from `hostsOf(programSlug)`. */
export function applyBundleSync(
  html: string,
  hostsOf: (programSlug: string) => { title: string; hosts: BundleHost[] } | null,
): string {
  return html.replace(BUNDLED, (whole, programSlug: string) => {
    const program = hostsOf(programSlug);
    if (!program) return whole;
    return `<!-- cw:bundled-in ${programSlug} -->${renderBundleNote(program.title, program.hosts)}<!-- /cw:bundled-in -->`;
  });
}

/** The included programs a page asks about. */
export function collectBundledPrograms(html: string): string[] {
  return [...new Set([...html.matchAll(BUNDLED)].map((match) => match[1]!))];
}
