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
 * Prices are not written here beyond the first figure: every card carries
 * `data-cw-price`, and `priceSync` sets it from the charged offer afterwards,
 * the same way it always has.
 *
 * NO FORMATS IS NOT «REMOVE EVERYTHING». An empty list is what a failed read
 * looks like too, so the typed cards stand untouched.
 */

import type { BundleHost, ProgramFormat } from "@/lib/experiences/formats";
import { PLATFORM_ORIGIN } from "@/lib/surfaces/catalog";

const BLOCK = /<!--\s*cw:formats\s+([a-z0-9-]+)\s*-->([\s\S]*?)<!--\s*\/cw:formats\s*-->/g;
const CARD = /<!--\s*cw:format\s+([a-z0-9:_-]+)\s*-->([\s\S]*?)<!--\s*\/cw:format\s*-->/g;

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

function kindWord(kind: ProgramFormat["includes"][number]["kind"]): string {
  return kind === "mini" ? "міні-курс" : kind === "checklist" ? "чек-лист" : "програма";
}

function includedItems(format: ProgramFormat): string {
  return format.includes
    .map((program) => `<li data-cw-included>${escape(program.title)} — ${kindWord(program.kind)}</li>`)
    .join("");
}

function cohortLine(format: ProgramFormat): string | null {
  if (!format.cohortStartsOn) return null;
  const date = new Date(`${format.cohortStartsOn}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : `старт потоку ${COHORT_DATE.format(date)}`;
}

/** A card for a format the landing does not have one for, in its own markup. */
export function renderFormatCard(format: ProgramFormat, programTitle: string): string {
  const dark = format.mode === "checkout";
  const price = format.amount !== null ? `${format.amount} грн` : "за запитом";
  const note = cohortLine(format) ?? (format.mode === "lead" ? "ціну узгоджуємо в розмові" : "повний доступ");
  // The author's list when there is one — the same lines the program page
  // shows; otherwise the one thing certainly true, and the summary.
  const own =
    format.features.length > 0
      ? format.features.map((feature) => `<li>${escape(feature)}</li>`)
      : [`<li>Уся програма «${escape(programTitle)}»</li>`, format.summary ? `<li>${escape(format.summary)}</li>` : ""];
  const features = [...own, includedItems(format)].join("");
  const action =
    format.mode === "lead"
      ? `<button type="button" class="btn btn-primary fc-cta" data-lead-open="${escape(format.code)}">Залишити заявку ${ARROW}</button>`
      : `<a href="#offer" class="btn btn-primary fc-cta openModal" data-cta-final data-cw-product="${escape(format.code)}" data-cw-offer-id="${escape(format.code.replace(/[^a-z0-9]+/g, "_"))}" data-cw-price-value="${format.amount ?? 0}">${format.format === "group" ? "Приєднатися до потоку" : "Почати"} ${ARROW}</a>`;

  return [
    `<!-- cw:format ${format.code} -->`,
    `<div class="format-card ${dark ? "self" : "premium"} reveal"${dark ? " data-cw-nav-dark" : ""}>`,
    `<span class="fc-badge">${BADGE[format.format]}</span>`,
    `<div class="fc-title">${escape(programTitle)} — ${escape(format.label.toLowerCase())}</div>`,
    `<div class="fc-price"><b data-cw-price="${escape(format.code)}">${price}</b><small>${escape(note)}</small></div>`,
    `<ul class="fc-features">${features}</ul>`,
    action,
    `</div>`,
    `<!-- /cw:format -->`,
  ].join("\n");
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
function syncCard(card: string, format: ProgramFormat): string {
  const own =
    format.features.length > 0 ? format.features.map((feature) => `<li>${escape(feature)}</li>`).join("") : null;
  return card.replace(
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
): string {
  return html.replace(BLOCK, (whole, programSlug: string, inner: string) => {
    const program = formatsOf(programSlug);
    if (!program || program.formats.length === 0) return whole;

    const cards = new Map<string, string>();
    for (const match of inner.matchAll(CARD)) cards.set(match[1]!, match[2]!);

    const body = program.formats
      .map((format) => {
        const existing = cards.get(format.code);
        return existing !== undefined
          ? `<!-- cw:format ${format.code} -->${syncCard(existing, format)}<!-- /cw:format -->`
          : renderFormatCard(format, program.title);
      })
      .join("\n");
    return `<!-- cw:formats ${programSlug} -->\n${body}\n<!-- /cw:formats -->`;
  });
}

/** The program addresses a page asks formats for. */
export function collectFormatPrograms(html: string): string[] {
  return [...new Set([...html.matchAll(BLOCK)].map((match) => match[1]!))];
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
