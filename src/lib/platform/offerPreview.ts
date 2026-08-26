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
 *   title    — one line, the name and nothing after the dash;
 *   summary  — three lines, why this exists.
 *
 * The line limits are enforced in CSS (`.programTileBody`, preview format);
 * this module owns the two string rules, so that a title cut for a card and a
 * title cut for a rail are cut the same way.
 */

/** The dashes a Ukrainian title actually uses to hang an explanation off a name. */
const NAME_TAIL = /\s[—–-]\s.*$/u;

/**
 * The ceiling on a course title, in characters. HARD — the builder will not
 * accept a longer one.
 *
 * It guards the surfaces a title cannot be shortened for: the h1 of the offer
 * page, the browser tab, the breadcrumb, the WayForPay invoice line. None of
 * those clip, so an unbounded title does not get cut there, it gets four lines
 * of hero or a truncated payment description a buyer has to trust.
 *
 * Set above the longest title anybody has actually written — Reset Day's is 57
 * — so the rule stops runaways rather than editing existing work. A limit that
 * bites on the courses already in the shelf is a migration, not a limit.
 */
export const OFFER_TITLE_MAX = 70;

/**
 * What fits on one line of a card, in characters. SOFT — the builder warns and
 * lets the author decide.
 *
 * Measured, not chosen: at the tightest desktop step the tile gives the name
 * 280px at 19.5px type, which is about 24 Cyrillic characters, and every name
 * in the current catalogue is at or under it («Природнє тіло з Аюрведою» is
 * exactly 24). Past that the CSS clamp ellipsises, which is a correct answer to
 * a title nobody warned the author about — and a poor substitute for warning
 * them.
 *
 * Soft on purpose. A name is the author's, some names are genuinely long, and
 * an ellipsis on a card is survivable in a way that a rejected title is not.
 */
export const OFFER_CARD_TITLE_MAX = 24;

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
 * written into one, and the second half already has a home: the tagline on the
 * offer page, which says the same thing in a sentence the buyer can read. A
 * card gets the name.
 *
 * Only a SPACED dash counts. «Short-Перезавантаження» is one word with a hyphen
 * in it, and cutting there would leave the product called «Short».
 */
export function offerName(title: string): string {
  return title.replace(NAME_TAIL, "").trim() || title.trim();
}

/**
 * The half the name gave up, for the one surface with room to print it.
 *
 * The tail is not noise — «практикум з умовного голодування» says what kind of
 * thing this is, and an author who wrote it into the title wrote it for a
 * reason. It just cannot be part of a name. So the offer page prints it as a
 * subtitle, between the name and the tagline: the name says what it is called,
 * this says what it is, the tagline says why you would.
 *
 * Empty when the title is only a name, and the page prints nothing rather than
 * an empty line.
 */
export function offerSubtitle(title: string): string {
  const match = title.match(NAME_TAIL);
  if (!match || offerName(title) === title.trim()) return "";
  return match[0].replace(/^\s[—–-]\s/u, "").trim();
}

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
