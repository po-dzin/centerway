/**
 * One definition of "where the icon sprite lives", version included.
 *
 * THE SPRITE IS REFERENCED BY ID and keeps its filename when it is rebaked, so
 * a cached copy can answer a `<use>` with yesterday's set of ids. On
 * 2026-09-11 `cw-ink-rule` was added, every ink mark on the site began pointing
 * at it, and for anyone holding an older sprite that reference resolved to
 * nothing — which paints nothing at all: no error, no fallback, no empty box.
 * The marks vanished site-wide and read as a CSS bug.
 *
 * `CW_SPRITE_VERSION` is the baked file's own content hash, written by
 * `scripts/icons-bake.mjs` into the same generated module as the name union.
 * A changed sprite is therefore a changed URL, which is what lets
 * `next.config.ts` serve `/cw/icons/**` as `immutable`.
 *
 * Both consumers live here rather than one each, because the two halves of the
 * product reach the same file by different names and a version that drifts
 * between them is the bug this exists to prevent.
 */

import { CW_SPRITE_VERSION } from "@/lib/brand/iconNames";

/** The platform's own copy, used by `Icon`. */
export const PLATFORM_SPRITE_URL = `/cw/icons/cw-icons.svg?v=${CW_SPRITE_VERSION}`;

/**
 * Stamps the version onto every landing reference to the sprite.
 *
 * The landings type the URL into their markup — 164 times across eight files —
 * so versioning it at the source would put that churn into hand-written HTML on
 * every rebake. It is done on the way out instead, by both serving paths:
 * `createStaticLandingGet` for the funnel brands and `prepareLandingHtml` for
 * the managed pages. Idempotent, so a document that passes through both is
 * stamped once.
 */
export function versionSpriteUrls(html: string): string {
  return html.replace(
    /(["'(])(\/shared\/img\/cw-icons\.svg)(?:\?v=[0-9a-f]+)?(#|["')])/g,
    (_match, open: string, url: string, tail: string) => `${open}${url}?v=${CW_SPRITE_VERSION}${tail}`,
  );
}
