import type { CSSProperties } from "react";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import styles from "@/components/platform/PlatformHeroStyles";
import { PlatformHeroPhoto } from "@/components/platform/PlatformHeroPhoto";
import { DOSHA_TEST_ROUTE } from "@/lib/platform/tests";
import { HubIntroVideo } from "./IntroVideo";

/* Focus for the threshold plate (1312×816, ratio 1.608), read through the
   shared hero framing contract in PlatformResponsive.module.css. Measured off
   the plate, as a fraction of its height: empty wall 0–12%, doorway lintel 12%,
   threshold 87%, sandals 86–92%, paving 86–100%. Everything that carries the
   photograph lives below the top eighth, so when the crop turns vertical the
   frame is anchored low and the crop is spent on the bare wall. Sideways the
   frame leans right, where the doorway (64–91% across) and the bamboo are; the
   left is the wall the text scrim wants under it anyway. */
const HERO_FRAMING = {
  "--hero-photo-x-desktop": "62%",
  "--hero-photo-y-desktop": "100%",
  "--hero-photo-y-wide": "90%",
  "--hero-photo-y-ultrawide": "82%",
  /* The portrait master is its own composition, not a crop of the landscape
     plate: a centred read leaves too much bare wall above the doorway, so the
     window is pushed down and in. */
  "--hero-photo-x-mobile": "50%",
  "--hero-photo-y-mobile": "68%",
  /* THE ANCHOR CANNOT SIT PAST THE EDGE IT ANCHORS.
     For any transform-origin below the box, scaling drags the bottom edge
     UP with it — only an origin sitting exactly AT the bottom (100%) is a
     fixed point under a y-scale. This was 125%, a 211px overshoot past the
     box's own bottom that reads as "push the crop down further" but instead
     pulled the covered image's bottom edge 30px short of the viewport at
     844px tall, exposing the layer's scrim-ink background as a dark band
     under the CTA. 100% keeps the algebra honest: bottom stays pinned at
     every viewport height, and the zoom still reveals more of what sits
     above it exactly as intended. */
  "--hero-photo-zoom-mobile": "1.14",
  "--hero-photo-origin-mobile": "center 100%",
} as CSSProperties;

export function HubHero() {
  return (
    <section className={styles.heroFeature} id="center" data-cw-topbar-tone="dark" style={HERO_FRAMING}>
      <div className={styles.heroPhotoLayer}>
        {/* A PORTRAIT MASTER, not a crop. The landscape plate is a scene built
            across the frame — doorway right, sandals at the foot of the wall
            left — and a portrait viewport shows about a third of its width, so
            the phone used to render the inside of the doorway and nothing else:
            no wall, no threshold, no shoes. The portrait frame is the same room
            recomposed for the tall shape, with the doorway lifted above the
            lower third because the copy is bottom-anchored there. Swapped by
            PlatformHeroPhoto on the same 560px line every other platform hero
            uses. */}
        <PlatformHeroPhoto
          artwork={{
            desktop: "/shared/img/home-hero-threshold-2026-08-v12.webp",
            mobile: "/shared/img/home-hero-threshold-2026-08-v12-portrait.webp",
          }}
          alt="Поріг: вхід у практику CenterWay"
          className={styles.expertImage}
          eager
        />
      </div>
      <div className={styles.heroFeatureContent}>
        <p className={styles.heroBadge}>
          <span>Тіло · Ритм · Опора</span>
        </p>
        <h1 className={styles.heroFeatureTitle}>CenterWay</h1>
        <p className={styles.heroFeatureLead}>
          Шлях до себе - не пошук нової особистості, а повернення до своєї істинної природи через тіло, увагу і практику.
        </p>
        <div className={styles.heroFeatureActions}>
          <Link className={styles.heroPrimaryButton} href="#intro-video">
            Почати шлях
          </Link>
        </div>
      </div>
    </section>
  );
}

export function HubIntro() {
  return (
    <section className={`${styles.container} ${styles.section}`} id="signals">
      <div className={styles.videoSection} data-cw-hub-intro="layout">
        <div className={styles.videoPanel} id="intro-video" data-cw-hub-intro="video">
          {/* The panel is the object beside the card and matches its height; the
              PLAYER inside it keeps 16:9 and centres on the panel's own dark
              ground. Stretching the iframe itself is what used to turn the
              player into a near-square on desktop — that is a property of the
              video, not of the row. */}
          {/* The hero's CTA scrolls DOWN to this player, so it is below the
              fold by construction — and a YouTube embed is the heaviest thing
              on the page by a distance. It is not rendered until the visitor
              presses it; see IntroVideo for the second, larger reason. */}
          <HubIntroVideo />
        </div>
        <aside className={styles.videoAside} id="diagnostics" data-cw-hub-intro="aside">
          <div className={styles.videoDecisionIntro}>
            <p className={styles.label}>Тест доші · перший крок</p>
            <h2 className={styles.title}>Почніть із тесту доші</h2>
            <p className={styles.videoDecisionText}>Кілька хвилин, щоб уважніше подивитися на свій поточний стан і зрозуміти, з чого почати.</p>
          </div>
          <div className={styles.videoDecisionRail}>
            {/* ONE ACTION. This card used to offer the dosha test and a
                consultation side by side, and the consultation is where the
                last block of this very page ends — the same destination, twice
                on one screen, with the second button making the first look like
                one of two equal options. The card asks one thing: take the
                test. */}
            <div className={styles.videoActionGrid} data-cw-hub-intro="actions">
              <Link className={styles.videoActionPrimary} href={DOSHA_TEST_ROUTE}>
                Тест доші
              </Link>
            </div>
            {/* These two are entries in the diagnostics catalogue, not the
                catalogue — the panel names the rest rather than leaving the
                topbar as the only route to it. */}
            <Link className={styles.videoDecisionMore} href="/tests">
              Усі тести
              <Icon className={styles.videoDecisionMoreArrow} name="arrow-right" size={18} />
            </Link>
          </div>
        </aside>
      </div>
    </section>
  );
}
