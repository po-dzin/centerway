/**
 * The top of `/feed` (G 2026-10-17, mockup `.feedHero`): a short cinematic
 * photo — a group practising on a forest terrace — with the page's title over
 * it, low enough (≈ 19rem) that the first post still starts on the first
 * screen.
 *
 * The photo's tone is baked into the file; over it lies only a directional
 * scrim (bottom and left, where the words are), never a CSS filter. The hero
 * names its focus point and nothing else. «Спільнота» is the photo G kept;
 * the other candidate («Поріг») is not shipped.
 */

import { feedCopy } from "./copy";
import styles from "./Feed.module.css";

const PHOTO = "/cw/platform/pages/feed-hero-community-v1.webp";
const PHOTO_960 = "/cw/platform/pages/feed-hero-community-v1-960.webp";

export function FeedHero() {
  return (
    <header className={styles.hero}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a static plate with its own 960/1280 renditions */}
      <img
        className={styles.heroPhoto}
        src={PHOTO}
        srcSet={`${PHOTO_960} 960w, ${PHOTO} 1280w`}
        sizes="(max-width: 44rem) 100vw, 42rem"
        width={1280}
        height={800}
        alt={feedCopy.heroAlt}
        fetchPriority="high"
        decoding="async"
      />
      <div className={styles.heroBody}>
        <h1 className={styles.heroTitle}>{feedCopy.title}</h1>
        <p className={styles.heroLead}>{feedCopy.heroLead}</p>
      </div>
    </header>
  );
}
