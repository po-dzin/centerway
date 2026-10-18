/**
 * The top of `/feed` (G 2026-10-18): a plaster wall with paper pieces taped to
 * it, each one a post made by hand — a sheet with rows of text, a checklist,
 * two photographs, a strip with a drawn sound-wave. It is a band behind the top
 * of the page and fades into it.
 *
 * THE PIECES STAND AT THE SIDES, THE MIDDLE IS BARE. On a desktop the sheet and
 * the checklist hang to the left of the column and the photographs and the
 * strip to the right, so the page's head and the first post can stand high, on
 * the plaster between them. On a phone the pieces take a row under the header
 * and the head stands on the bare plaster below them. Each plate is composed
 * for its screen: a wide one, and a tall one for a tablet and a phone.
 * Masking tape only — clothespins read as floating on this wall — and no
 * letters anywhere in the photograph: the text on the paper is drawn as lines,
 * so the page's own words are the only words.
 *
 * The photo's tone is baked into the file; no CSS filter. The scene is light,
 * so on the dark theme a layer of the page's own ground dims it, and the words
 * over it take the theme's text colour either way.
 */

import { PlatformPageHead } from "@/components/platform/PlatformPageHead";

import { feedCopy } from "./copy";
import styles from "./Feed.module.css";

const WIDE = "/cw/platform/pages/feed-hero-wall-v3.webp";
const WIDE_1200 = "/cw/platform/pages/feed-hero-wall-v3-1200.webp";
const TALL = "/cw/platform/pages/feed-hero-wall-v3-portrait.webp";
const TALL_560 = "/cw/platform/pages/feed-hero-wall-v3-portrait-560.webp";

/** The wall itself: behind everything, the width of the page. */
export function FeedStage() {
  return (
    <div className={styles.stage}>
      <picture>
        <source media="(max-width: 64rem)" srcSet={`${TALL_560} 560w, ${TALL} 780w`} sizes="100vw" />
        <img
          className={styles.stagePhoto}
          src={WIDE}
          srcSet={`${WIDE_1200} 1200w, ${WIDE} 1600w`}
          sizes="100vw"
          width={1600}
          height={540}
          alt={feedCopy.heroAlt}
          fetchPriority="high"
          decoding="async"
        />
      </picture>
    </div>
  );
}

/** The page's head, in the platform's one shape (label over title), on the bare plaster between the pieces. What the page is about is the pinned post's to say. */
export function FeedHeading() {
  return <PlatformPageHead label={feedCopy.heroLabel} title={feedCopy.title} />;
}
