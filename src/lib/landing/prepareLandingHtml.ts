import { readFile } from "node:fs/promises";
import path from "node:path";
import { getLandingPublicRouteName, LANDING_ROUTE_CONFIG } from "@/lib/landing/config";
import { LANDING_CONTENT } from "@/lib/landing/content";
import { UTILITY_FILE_BY_PAGE, type UtilityPage } from "@/lib/landing/contracts";
import type { LandingResolvedOffer } from "@/lib/landing/offers";
import type { StaticLandingProduct } from "@/lib/landing/types";

type PrepareEntryOptions = {
  product: StaticLandingProduct;
  pageKind: "entry";
  offer?: LandingResolvedOffer | null;
};

type PrepareUtilityOptions = {
  product: StaticLandingProduct;
  pageKind: "utility";
  page: UtilityPage;
};

export type PrepareLandingHtmlOptions = PrepareEntryOptions | PrepareUtilityOptions;

type PreparedEntryHtml = {
  pageKind: "entry";
  page: ReturnType<typeof getLandingPublicRouteName>;
  bodyHtml: string;
};

type PreparedUtilityHtml = {
  pageKind: "utility";
  page: UtilityPage;
  html: string;
};

const TRACKING_BLOCKS: RegExp[] = [
  /<!--\s*(?:✅\s*)?Meta Pixel[\s\S]*?<!--\s*(?:✅\s*)?End Meta Pixel[\s\S]*?-->/gi,
  /<script[^>]*>\s*\(function\(c,l,a,r,i,t,y\)\{[\s\S]*?clarity[\s\S]*?<\/script>/gi,
  /<script[^>]*>[\s\S]*?localStorage\.setItem\((['"])cw_attrib\1[\s\S]*?<\/script>/gi,
];

const SCRIPT_TAG_BLOCK = /<script[\s\S]*?<\/script>/gi;
const MANAGED_HEAD_PATTERN =
  /<base[^>]*href="\/(?:reboot|short|irem)\/"[^>]*>\s*|<link[^>]*href="\/shared\/css\/landing\.bridge\.css"[^>]*>\s*|<script[^>]*src="\/shared\/js\/landing-pixel\.js"[^>]*><\/script>\s*|<script[^>]*src="\/shared\/js\/landing-runtime\.js"[^>]*><\/script>\s*/gi;
const TYPED_HERO_FLAG = "CW_TYPED_HERO_SHORT_IREM";

function isTypedHeroEnabled(): boolean {
  const raw = process.env[TYPED_HERO_FLAG]?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

function replaceIfMatch(html: string, pattern: RegExp, makeReplacement: (match: RegExpExecArray) => string): string {
  const match = pattern.exec(html);
  if (!match) {
    return html;
  }
  return html.slice(0, match.index) + makeReplacement(match) + html.slice(match.index + match[0].length);
}

function applyTypedHeroReplacements(product: StaticLandingProduct, html: string): string {
  if (!isTypedHeroEnabled()) {
    return html;
  }

  const hero = LANDING_CONTENT[product].hero;
  let next = html;

  if (product === "short") {
    next = replaceIfMatch(next, /(<span class="badge">)([\s\S]*?)(<\/span>)/i, (match) => {
      return `${match[1]}${hero.badge}${match[3]}`;
    });

    const shortTitleMatch = hero.title.match(/^(.*?-)(.+)$/);
    if (shortTitleMatch) {
      const titlePrefix = shortTitleMatch[1];
      const titleAccent = shortTitleMatch[2];
      next = replaceIfMatch(next, /(<h1>)[\s\S]*?(<span class="accent">)([\s\S]*?)(<\/span>)([\s\S]*?<\/h1>)/i, (match) => {
        return `${match[1]}${titlePrefix}${match[2]}${titleAccent}${match[4]}${match[5]}`;
      });
    }

    next = replaceIfMatch(next, /(<h3>)([\s\S]*?)(<\/h3>)/i, (match) => {
      return `${match[1]}${hero.subtitle}${match[3]}`;
    });

    if (hero.lead) {
      next = replaceIfMatch(
        next,
        /(<div class="benefits-block">[\s\S]*?<p>)([\s\S]*?)(<\/p>[\s\S]*?<ul class="benefits__list">)/i,
        (match) => `${match[1]}${hero.lead}${match[3]}`
      );
    }

    if (hero.chips.length > 0) {
      next = replaceIfMatch(next, /(<ul class="benefits__list">)([\s\S]*?)(<\/ul>)/i, (match) => {
        const rewrittenList = hero.chips
          .map((chip) => {
            return `<li class="benefits__item">
                        <span class="benefits__icon">✓</span>
                        ${chip}
                        </li>`;
          })
          .join("\n\n                        ");
        return `${match[1]}
                        ${rewrittenList}
                    ${match[3]}`;
      });
    }

    if (hero.note) {
      next = replaceIfMatch(
        next,
        /(<p class="hero-proof__quote hero-proof__quote-after-list">)([\s\S]*?)(<\/p>)/i,
        (match) => `${match[1]}${hero.note}${match[3]}`
      );
    }

    if (hero.price.preface) {
      next = replaceIfMatch(next, /(<p class="section-hero-preprice">)([\s\S]*?)(<\/p>)/i, (match) => {
        return `${match[1]}${hero.price.preface}${match[3]}`;
      });
    }

    next = replaceIfMatch(next, /(<button class="openModal"\s+data-cta-primary>)([\s\S]*?)(<\/button>)/i, (match) => {
      return `${match[1]}${hero.ctaPrimaryLabel}${match[3]}`;
    });

    if (hero.priceOld) {
      next = replaceIfMatch(next, /(<span class="price-old">)([\s\S]*?)(<\/span>)/i, (match) => {
        return `${match[1]}${hero.priceOld}${match[3]}`;
      });
    }

    next = replaceIfMatch(next, /(<span class="price-current">)([\s\S]*?)(<\/span>)/i, (match) => {
      return `${match[1]}${hero.priceCurrent}${match[3]}`;
    });

    if (hero.price.notes.length >= 2) {
      next = replaceIfMatch(next, /(<span class="price-note">)([\s\S]*?)(<\/span>[\s\S]*?<span class="price-note">)([\s\S]*?)(<\/span>)/i, (match) => {
        return `${match[1]}${hero.price.notes[0]}${match[3]}${hero.price.notes[1]}${match[5]}`;
      });
    }

    if (hero.cta.note) {
      next = replaceIfMatch(next, /(<p class="cta-note">)([\s\S]*?)(<\/p>)/i, (match) => {
        return `${match[1]}${hero.cta.note}${match[3]}`;
      });
    }

    next = replaceIfMatch(
      next,
      /(<div id="menu" class="default" data-sticky-menu>[\s\S]*?<button class="openModal">)([\s\S]*?)(<\/button>)/i,
      (match) => `${match[1]}${hero.ctaStickyLabel}${match[3]}`
    );

    return next;
  }

  next = replaceIfMatch(next, /(<span class="hero-badge">)([\s\S]*?)(<\/span>)/i, (match) => {
    return `${match[1]}${hero.badge}${match[3]}`;
  });

  next = replaceIfMatch(next, /(<h1>)([\s\S]*?)(<\/h1>)/i, (match) => {
    return `${match[1]}${hero.title}${match[3]}`;
  });

  next = replaceIfMatch(next, /(<h4>)([\s\S]*?)(<\/h4>)/i, (match) => {
    return `${match[1]}${hero.subtitle}${match[3]}`;
  });

  if (hero.lead) {
    next = replaceIfMatch(next, /(<p class="hero-highlights__title">)([\s\S]*?)(<\/p>)/i, (match) => {
      return `${match[1]}${hero.lead}${match[3]}`;
    });
  }

  if (hero.chips.length > 0) {
    next = replaceIfMatch(next, /(<div class="hero-highlights__chips">)([\s\S]*?)(<\/div>)/i, (match) => {
      const rewrittenChips = hero.chips.map((chip) => `<span>${chip}</span>`).join("\n");
      return `${match[1]}
${rewrittenChips}
${match[3]}`;
    });
  }

  if (hero.note) {
    next = replaceIfMatch(next, /(<p class="hero-highlights__note">)([\s\S]*?)(<\/p>)/i, (match) => {
      return `${match[1]}${hero.note}${match[3]}`;
    });
  }

  next = replaceIfMatch(next, /(<button class="openModal"\s+data-cta-primary>)([\s\S]*?)(<\/button>)/i, (match) => {
    return `${match[1]}${hero.ctaPrimaryLabel}${match[3]}`;
  });

  next = replaceIfMatch(next, /(<div class="price"><span>)([\s\S]*?)(<\/span><\/div>)/i, (match) => {
    return `${match[1]}${hero.priceCurrent}${match[3]}`;
  });

  next = replaceIfMatch(
    next,
    /(<div id="menu" class="default" data-sticky-menu>[\s\S]*?<button class="openModal">)([\s\S]*?)(<\/button>)/i,
    (match) => `${match[1]}${hero.ctaStickyLabel}${match[3]}`
  );

  return next;
}

function buildIremPromoNoteMarkup(offer: LandingResolvedOffer): string {
  if (offer.offerApplied && !offer.offerExpired && offer.expiresAt) {
    return `<p class="promo-note" data-promo-note><span class="promo-note__label" data-promo-note-label>До завершення персональної ціни</span><span class="promo-timer" data-promo-timer aria-live="polite">48:00:00</span></p>`;
  }

  const note = offer.activeNote ?? offer.expiredNote;
  return note ? `<p class="promo-note">${note}</p>` : "";
}

function buildIremPriceMarkup(offer: LandingResolvedOffer, includeNote: boolean): string {
  const discountBadge =
    offer.offerApplied && !offer.offerExpired && offer.discountPercent && offer.discountPercent > 0
      ? `<span class="price-discount-badge">-${offer.discountPercent}%</span>`
      : "";
  const stack = offer.oldPriceLabel
    ? `<div class="price-stack"><span class="price-old">${offer.oldPriceLabel}</span><span class="price-current">${offer.currentPriceLabel}</span>${discountBadge}</div>`
    : `<span class="price-current">${offer.currentPriceLabel}</span>`;
  const note = includeNote ? buildIremPromoNoteMarkup(offer) : "";
  return `<div class="price">${stack}</div>${note}`;
}

function applyOfferReplacements(product: StaticLandingProduct, html: string, offer?: LandingResolvedOffer | null): string {
  if (product !== "irem" || !offer) {
    return html;
  }

  let next = html;
  const heroMarkup = buildIremPriceMarkup(offer, true);
  const offerMarkup = buildIremPriceMarkup(offer, true);

  next = replaceIfMatch(
    next,
    /(<div id="divprice">)[\s\S]*?(<button class="openModal"\s+data-cta-primary>[\s\S]*?<\/button>)/i,
    (match) => `${match[1]}${heroMarkup}${match[2]}`
  );

  next = replaceIfMatch(
    next,
    /(<div class="offer-cta">[\s\S]*?<p class="offer-lead">[\s\S]*?<\/p>)[\s\S]*?(<button class="openModal"\s+data-cta-final>[\s\S]*?<\/button>)/i,
    (match) => `${match[1]}${offerMarkup}${match[2]}`
  );

  return next;
}

function stripInlineTracking(html: string): string {
  return TRACKING_BLOCKS.reduce((next, regex) => next.replace(regex, ""), html);
}

function extractBody(html: string, product: StaticLandingProduct): string {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (!match) {
    throw new Error(`Unable to extract <body> from ${product} landing source`);
  }
  return match[1];
}

function toProductAssetPath(product: StaticLandingProduct, url: string): string {
  if (
    url.startsWith("/") ||
    url.startsWith("#") ||
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("//") ||
    url.startsWith("mailto:") ||
    url.startsWith("tel:") ||
    url.startsWith("data:") ||
    url.startsWith("javascript:")
  ) {
    return url;
  }

  if (url.startsWith("../shared/")) {
    return `/shared/${url.slice("../shared/".length)}`;
  }

  const normalized = url.replace(/^(\.\/)+/g, "").replace(/^(\.\.\/)+/g, "");
  return `${LANDING_ROUTE_CONFIG[product].assetPrefix}/${normalized}`;
}

function normalizeRelativeUrls(product: StaticLandingProduct, html: string): string {
  return html.replace(/\b(src|href|data-src|poster|action)=(['"])([^'"]+)\2/gi, (_, attr, quote, value) => {
    return `${attr}=${quote}${toProductAssetPath(product, value)}${quote}`;
  });
}

function injectHtmlDataAttrs(html: string, product: StaticLandingProduct, page: UtilityPage): string {
  return html.replace(
    /<html([^>]*)>/i,
    `<html$1 data-cw-landing="${product}" data-cw-runtime="next" data-cw-page="${page}">`
  );
}

function injectManagedHead(html: string, product: StaticLandingProduct): string {
  const { assetPrefix } = LANDING_ROUTE_CONFIG[product];
  const inject = [
    `    <base href="${assetPrefix}/">`,
    `    <link rel="stylesheet" href="/shared/css/landing.bridge.css">`,
    `    <script src="/shared/js/landing-pixel.js" data-cw-product="${product}"></script>`,
  ].join("\n");

  if (/<meta name="viewport" content="width=device-width,\s*initial-scale=1(?:\.0)?"\s*\/?>/i.test(html)) {
    return html.replace(
      /<meta name="viewport" content="width=device-width,\s*initial-scale=1(?:\.0)?"\s*\/?>/i,
      (match) => `${match}\n${inject}`
    );
  }

  return html.replace(/<\/head>/i, `${inject}\n</head>`);
}

function injectManagedRuntimeScript(html: string): string {
  const runtimeScript = '  <script src="/shared/js/landing-runtime.js" defer></script>\n';
  return html.replace(/<\/body>/i, `${runtimeScript}</body>`);
}

function patchUtilityPageContent(html: string, product: StaticLandingProduct, page: UtilityPage): string {
  const content = LANDING_CONTENT[product].utility;

  if (page === "thanks") {
    return html
      .replace(
        /(<a class="btn primary" href=")[^"]+(" target="_blank" rel="noopener">Відкрити бот<\/a>)/i,
        `$1${content.thanks.botUrl}$2`
      )
      .replace(
        /(<a class="btn" href=")[^"]+(">Повернутися на сайт<\/a>)/i,
        `$1${content.thanks.siteUrl}$2`
      )
      .replace(
        /window\.location\.href\s*=\s*"[^"]+";/i,
        `window.location.href = "${content.thanks.botUrl}";`
      );
  }

  if (page === "pay-failed") {
    return html.replace(
      /(<a class="btn primary" href=")[^"]+(">Спробувати ще раз<\/a>)/i,
      `$1${content.payFailed.retryUrl}$2`
    );
  }

  return html;
}

async function loadLandingHtml(product: StaticLandingProduct, options: PrepareLandingHtmlOptions): Promise<string> {
  const htmlPath =
    options.pageKind === "entry"
      ? LANDING_ROUTE_CONFIG[product].htmlPath
      : path.join(LANDING_ROUTE_CONFIG[product].assetName, UTILITY_FILE_BY_PAGE[options.page]);

  const sourcePath = path.join(process.cwd(), "src", "landing-static", htmlPath);
  return readFile(sourcePath, "utf-8");
}

export async function prepareLandingHtml(options: PrepareEntryOptions): Promise<PreparedEntryHtml>;
export async function prepareLandingHtml(options: PrepareUtilityOptions): Promise<PreparedUtilityHtml>;
export async function prepareLandingHtml(
  options: PrepareLandingHtmlOptions
): Promise<PreparedEntryHtml | PreparedUtilityHtml> {
  const { product } = options;
  let html = await loadLandingHtml(product, options);

  html = stripInlineTracking(html);
  html = normalizeRelativeUrls(product, html);

  if (options.pageKind === "entry") {
    html = applyTypedHeroReplacements(product, html);
    html = applyOfferReplacements(product, html, options.offer);
    const bodyHtml = extractBody(html, product).replace(SCRIPT_TAG_BLOCK, "").trim();
    return {
      pageKind: "entry",
      page: getLandingPublicRouteName(product),
      bodyHtml,
    };
  }

  html = html.replace(MANAGED_HEAD_PATTERN, "");
  html = injectHtmlDataAttrs(html, product, options.page);
  html = injectManagedHead(html, product);
  html = patchUtilityPageContent(html, product, options.page);
  html = injectManagedRuntimeScript(html);

  return {
    pageKind: "utility",
    page: options.page,
    html,
  };
}
