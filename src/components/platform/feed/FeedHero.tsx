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
 * The photo's tone is baked into the file; no CSS filter. The wall is shot
 * twice, in daylight and by lamplight, and the page shows the one of its
 * theme; the words over it take the theme's text colour either way.
 */

import { feedCopy } from "./copy";
import styles from "./Feed.module.css";

const PLATE = "/cw/platform/pages/feed-hero-wall-v5";
const PLATE_TALL = "/cw/platform/pages/feed-hero-wall-v7";

/** One plate: the wide wall, and a tall one for a tablet and a phone. */
function Plate({ dark }: { dark: boolean }) {
  const sfx = dark ? "-dark" : "";
  return (
    <picture className={dark ? styles.plateDark : styles.plateLight}>
      <source
        media="(max-width: 56rem)"
        srcSet={`${PLATE_TALL}-portrait${sfx}-640.webp 640w, ${PLATE_TALL}-portrait${sfx}.webp 930w`}
        sizes="100vw"
      />
      <img
        className={styles.stagePhoto}
        src={`${PLATE}${sfx}.webp`}
        srcSet={`${PLATE}${sfx}-1200.webp 1200w, ${PLATE}${sfx}.webp 1584w`}
        sizes="100vw"
        width={1584}
        height={672}
        alt={dark ? "" : feedCopy.heroAlt}
        fetchPriority={dark ? "low" : "high"}
        loading={dark ? "lazy" : undefined}
        decoding="async"
      />
    </picture>
  );
}

/** The wall itself: behind everything, the width of the page. */
export function FeedStage() {
  return (
    <div className={styles.stage}>
      <Plate dark={false} />
      <Plate dark />
    </div>
  );
}

/**
 * The page's head: the platform's editorial title at its title size, and one
 * line under it that says what the page is. It stands on the bare plaster
 * between the pieces, in ink with a glow of the page's own ground so it holds
 * on the shaded part of the plate. What the page holds is the pinned post's to
 * say.
 */
export function FeedHeading() {
  return (
    <header className={styles.heroBody}>
      <h1 className={styles.heroTitle}>{feedCopy.title}</h1>
      <p className={styles.heroLead}>{feedCopy.heroLead}</p>
    </header>
  );
}
