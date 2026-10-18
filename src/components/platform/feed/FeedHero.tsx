/**
 * The top of `/feed` (G 2026-10-18): a plaster wall with paper pieces taped to
 * it, each one a post made by hand — a sheet with a title and rows of text, a
 * checklist, two photographs, a strip with a drawn sound-wave. It is the
 * ground of the WHOLE first screen, not a card in the column, and it fades
 * into the page below it. The title stands on the bare plaster under the
 * pieces, and the feed's own pinned post is taped to the same wall.
 *
 * TWO PLATES, ART-DIRECTED. A wide one for a desktop and a tall one for a
 * phone, where a wide frame would be cut to its middle third. In both the
 * pieces take the top half and the plaster below is bare.
 * Masking tape only — clothespins read as floating on this wall — and no
 * letters anywhere in the photograph: the text on the paper is drawn as lines,
 * so the page's own words are the only words.
 *
 * The photo's tone is baked into the file; no CSS filter. The scene is light,
 * so on the dark theme a layer of the page's own ground dims it, and the words
 * over it take the theme's text colour either way.
 */

import { feedCopy } from "./copy";
import styles from "./Feed.module.css";

const WIDE = "/cw/platform/pages/feed-hero-wall-v2.webp";
const WIDE_1200 = "/cw/platform/pages/feed-hero-wall-v2-1200.webp";
const TALL = "/cw/platform/pages/feed-hero-wall-v2-portrait.webp";
const TALL_560 = "/cw/platform/pages/feed-hero-wall-v2-portrait-560.webp";

/** The wall itself: behind everything, the width of the page. */
export function FeedStage() {
  return (
    <div className={styles.stage}>
      <picture>
        <source media="(max-width: 35rem)" srcSet={`${TALL_560} 560w, ${TALL} 780w`} sizes="100vw" />
        <img
          className={styles.stagePhoto}
          src={WIDE}
          srcSet={`${WIDE_1200} 1200w, ${WIDE} 1600w`}
          sizes="100vw"
          width={1600}
          height={851}
          alt={feedCopy.heroAlt}
          fetchPriority="high"
          decoding="async"
        />
      </picture>
    </div>
  );
}

/** The page's title, on the plaster under the pieces. */
export function FeedHeading() {
  return (
    <header className={styles.heroBody}>
      <h1 className={styles.heroTitle}>{feedCopy.title}</h1>
      <p className={styles.heroLead}>{feedCopy.heroLead}</p>
    </header>
  );
}
