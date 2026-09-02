import {
  COURSE_TITLE_MAX,
  COURSE_TITLE_RAW_MAX,
  courseTitleName,
  courseTitleTail,
} from "@/lms-core";

/**
 * What a card is allowed to say about an offer.
 *
 * THE CARD IS A PREVIEW, NOT A SMALL PAGE. Reset Day arrived from the builder
 * carrying one string for both jobs — «Розвантажувальний день — практикум з
 * умовного голодування» — and the catalogue printed all of it: four lines of
 * title in a tile 24rem wide, above a tagline that had itself been promoted
 * into the eyebrow and wrapped onto two lines in capitals. Three different
 * sentences, all of them competing to be read first.
 *
 * So the preview has a shape now, and it is the same shape for every card:
 *
 *   eyebrow  — one line, the offer page's own badge (kind · duration);
 *   title    — two lines, the name and nothing after the dash;
 *   summary  — three lines, why this exists.
 *
 * The line limits are enforced in CSS (`.programTileBody`, preview format);
 * this module owns the two string rules, so that a title cut for a card and a
 * title cut for a rail are cut the same way.
 */

/**
 * The ceiling on a course NAME, in characters. HARD — the contract rejects a
 * longer one.
 *
 * It guards the surfaces a name cannot be shortened for: the h1 of the offer
 * page, the browser tab, the breadcrumb, the card. None of those clip, so an
 * unbounded name does not get cut there, it gets four lines of hero.
 *
 * Two mobile lines fit the measured 24 Cyrillic characters each. 48 is a
 * product boundary, not a clipping preference: every longer name would make
 * the card's fixed preview geometry depend on its copy.
 */
export const OFFER_TITLE_MAX = COURSE_TITLE_MAX;

/**
 * The ceiling on the whole TITLE STRING — the name plus the explanation hung
 * off it after a spaced dash.
 *
 * The two are different numbers because they guard different things: the name
 * has to fit a frame, the string has to fit an invoice line. A title field
 * capped at the NAME's ceiling silently truncates «Розвантажувальний день —
 * практикум з умовного голодування» while the author types it, which is how a
 * limit stops being a rule and starts being a bug.
 */
export const OFFER_TITLE_RAW_MAX = COURSE_TITLE_RAW_MAX;

/**
 * What fits in two lines of a card, in characters. The hard course-title limit
 * enforces this same ceiling; the builder's warning remains a clear recovery
 * path for already persisted legacy data.
 *
 * Measured at the tightest mobile rail: one line holds about 24 Cyrillic
 * characters at the shared card-title step. The two-line title therefore owns
 * 48 characters, with the CSS clamp as a defence for legacy rows.
 */
export const OFFER_CARD_TITLE_MAX = COURSE_TITLE_MAX;

/**
 * How many characters past the card's line this title runs — 0 when it fits.
 *
 * Counts the NAME, which is what a card prints: a title whose length is all in
 * the half after the dash costs the card nothing.
 */
export function offerCardOverflow(title: string): number {
  return Math.max(0, offerName(title).length - OFFER_CARD_TITLE_MAX);
}

/**
 * The name, without the explanation someone hung off it.
 *
 * «Розвантажувальний день — практикум з умовного голодування» is two fields
 * written into one, and the second half already has a home: the subtitle on the
 * offer page, which says the same thing where there is room for it. A card gets
 * the name.
 *
 * The split itself now lives in the core (src/lms-core/title.ts), because the
 * contract measures the title's ceiling against it — see COURSE_TITLE_MAX.
 * Re-exported under the storefront's own names so every caller here keeps them.
 */
export const offerName = courseTitleName;

/**
 * The half the name gave up, for the one surface with room to print it.
 *
 * The tail is not noise — «практикум з умовного голодування» says what kind of
 * thing this is, and an author who wrote it into the title wrote it for a
 * reason. It just cannot be part of a name.
 */
export const offerSubtitle = courseTitleTail;

/**
 * The line above the title: the offer page's badge, verbatim.
 *
 * The card used to put the TAGLINE here — a full sentence, uppercased by the
 * label style, over two lines. The eyebrow answers "what kind of thing is this
 * and how much of my life does it want", which is what the badge on the offer
 * page already answers, and a reader who follows the card should meet the same
 * two facts on arrival rather than a new pair.
 */
export function offerEyebrow(tag: string, duration?: string | null): string {
  return duration ? `${tag} · ${duration}` : tag;
}
