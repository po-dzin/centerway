/**
 * The price on a landing page, taken from wherever that product's price lives.
 *
 * WHY THIS EXISTS. A funnel landing is static HTML with the figure typed into
 * it, and the same product is also priced in `lms_course_offers`. On 2026-09-02
 * the two had drifted far enough to matter: the way21 landing displayed
 * «4100 грн» in its hero, its offer card and its own CTA, and the checkout
 * charged 1 ₴, because a QA price had been opened in `products.ts` and neither
 * the row nor the HTML knew. `loadPayableOffer` now answers for every door, so
 * the charged figure is right — this makes the PRINTED figure follow it.
 *
 * OPT-IN, ELEMENT BY ELEMENT. A landing prints several products: way21's page
 * quotes way21, the guided package, and a mini-course it cross-sells. So the
 * markup names which product each figure belongs to rather than the page
 * declaring one price:
 *
 *   <b data-cw-price="way21">4100 грн</b>
 *   <s data-cw-price="reset-day" data-cw-price-kind="list">1200 грн</s>
 *
 * ONLY THE NUMBER IS REPLACED. The text around it — «грн», «повний доступ», the
 * strike-through — is the landing's own typography, written by whoever designed
 * the page, and a formatter that imposed «4 100 ₴» everywhere would silently
 * restyle five selling pages. So the first run of digits inside the element is
 * substituted and everything else is left exactly as it was.
 *
 * THE TYPED FIGURE IS THE FALLBACK, NOT THE SOURCE. A product with no price to
 * read keeps whatever the HTML already said. That is deliberate: a landing that
 * rendered an empty price because a database read failed would be worse than
 * one showing yesterday's number, and this runs on the page that paid traffic
 * lands on.
 */

export type LandingPrice = {
  /** What the checkout will charge. */
  amount: number;
  /** What may be printed as the price before a discount, when there is one. */
  listAmount: number | null;
};

export type LandingPrices = Record<string, LandingPrice>;

/** `data-cw-price="<code>"`, optionally `data-cw-price-kind="list"`. */
const PRICED_ELEMENT =
  /<(\w+)((?:\s+[^<>]*?)?\sdata-cw-price="([^"]+)"(?:\s+[^<>]*?)?)>([\s\S]*?)<\/\1>/g;

/** The analytics value on a checkout trigger, so the pixel matches the page. */
const PRICE_VALUE_ATTR = /(<[^<>]*?\sdata-cw-product="([^"]+)"[^<>]*?\sdata-cw-price-value=")(\d+)(")/g;

/** Every product code the markup asks about, so the caller knows what to load. */
export function collectPriceCodes(html: string): string[] {
  const codes = new Set<string>();
  for (const match of html.matchAll(PRICED_ELEMENT)) codes.add(match[3]);
  for (const match of html.matchAll(PRICE_VALUE_ATTR)) codes.add(match[2]);
  return [...codes];
}

function figureFor(price: LandingPrice, kind: string | undefined): number | null {
  if (kind === "list") return price.listAmount;
  return price.amount;
}

/** Substitutes the first digit run, leaving «грн» and the rest untouched. */
function replaceNumber(inner: string, figure: number): string {
  /* Digits, plus the spaces a designer may have grouped them with — «4 100»
     is one number, not «4» followed by «100». The separator has to sit BETWEEN
     digit runs rather than trail them: matching it greedily swallowed the
     space before «грн» and printed «3200грн». Caught by the test, not by eye. */
  return inner.replace(/\d+(?:[   ]\d+)*/, String(figure));
}

export function applyPriceSync(html: string, prices: LandingPrices): string {
  let next = html.replace(PRICED_ELEMENT, (whole, tag: string, attrs: string, code: string, inner: string) => {
    const price = prices[code];
    if (!price) return whole;

    const kind = /\sdata-cw-price-kind="([^"]+)"/.exec(attrs)?.[1];
    const figure = figureFor(price, kind);
    // No agreed figure of that kind — a course with no strike-through price,
    // say. The typed text stands rather than being blanked.
    if (figure === null || !Number.isFinite(figure)) return whole;

    return `<${tag}${attrs}>${replaceNumber(inner, figure)}</${tag}>`;
  });

  next = next.replace(PRICE_VALUE_ATTR, (whole, head: string, code: string, _typed: string, tail: string) => {
    const price = prices[code];
    // The pixel value follows the CHARGED amount, never the list price: it is
    // what Meta optimises spend against, and a campaign told each sale is worth
    // the pre-discount figure bids for the wrong thing.
    return price ? `${head}${price.amount}${tail}` : whole;
  });

  return next;
}
