import type { CSSProperties } from "react";
import { PlatformBlockLink } from "@/components/platform/PlatformBlock";
import Link from "next/link";
import styles from "@/components/platform/PlatformHeroStyles";
import { PlatformHeroPhoto } from "@/components/platform/PlatformHeroPhoto";
import { Icon } from "@/components/Icon";
import { InteractionInkLabel } from "@/components/platform/InteractionInk";
import { homeTestRail } from "@/lib/platform/tests";
import { HubIntroVideo } from "./IntroVideo";
import { heroTitleFit } from "@/components/platform/heroTitleFit";

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
        <p className={styles.heroBadge} data-cw-header-tone="dark">
          <span>Тіло · Ритм · Опора</span>
        </p>
        <h1 className={styles.heroFeatureTitle} style={heroTitleFit("CenterWay")}>
          CenterWay
        </h1>
        <p className={styles.heroFeatureLead}>
          Шлях до себе — не пошук нової особистості, а повернення до своєї природи: через тіло, увагу, харчування і ритм
          дня.
        </p>
        <div className={styles.heroFeatureActions}>
          <a className={styles.heroPrimaryButton} href="#intro-video">
            Почати шлях
          </a>
        </div>
      </div>
    </section>
  );
}

export function HubIntro() {
  const rail = homeTestRail();
  /* «Усі тести» says how many there are once the panel stops showing all. */
  const allTestsLabel = rail.rows.length < rail.total ? `Усі тести (${rail.total})` : "Усі тести";
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
            {/* The way to the catalogue stands on the label's line on a wide
                screen — see `.videoDecisionHead` — and at the foot of the list
                everywhere else. Two copies, one displayed at a time. */}
            <div className={styles.videoDecisionHead}>
              <p className={styles.label}>Діагностика стану · перший крок</p>
              <span className={`${styles.videoDecisionMore} ${styles.videoDecisionMoreHead}`}>
                <PlatformBlockLink href="/tests" label={allTestsLabel} />
              </span>
            </div>
            <h2 className={`${styles.title} ${styles.videoDecisionTitle}`}>Почніть із себе, а не з програми</h2>
            <p className={styles.videoDecisionText}>
              Короткі тести про вашу природу, травлення, втому і ритм дня. Кожен займає кілька хвилин і показує, з чого
              почати саме вам.
            </p>
          </div>
          <div className={styles.videoDecisionRail}>
            {/* THE TESTS, NOT «THE FIRST TEST» (2026-09-27). This rail was one
                gold button to the dosha test, which was right while there was
                one test and silently hid the second the day it shipped. It is
                now the list of what can be taken today, read from the same
                registry as the /tests hub, so the next test appears here by
                being marked active. A list and not a carousel: two or three
                rows fit the panel beside the video without growing the row,
                and a carousel of two is mostly its own controls. The row is
                the choice, so there is no gold button competing with it — the
                hand-off from the hero lands on the list itself. */}
            <ul className={styles.videoTestList} data-cw-hub-intro="actions" data-density={rail.density}>
              {rail.rows.map((test) =>
                test.href ? (
                  <li key={test.slug}>
                    <Link className={styles.videoTestRow} href={test.href} data-cw-ink-control>
                      {rail.density === "compact" ? null : test.artwork ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          className={styles.videoTestThumb}
                          src={test.artwork.card ?? test.artwork.desktop}
                          alt=""
                          loading="lazy"
                          decoding="async"
                        />
                      ) : (
                        <span className={styles.videoTestThumb} aria-hidden="true" />
                      )}
                      <span className={styles.videoTestText}>
                        <span className={styles.videoTestTitle}>
                          {/* The selection stroke, not the link rule: a row of names is a
                              list of ways in, like the nav, and resting
                              underlines turned it into a column of links. The
                              mark appears under the pointer only. */}
                          <InteractionInkLabel variant="navigation">{test.title}</InteractionInkLabel>
                        </span>
                        <span className={styles.videoTestMeta}>
                          {test.tag} · {test.format}
                        </span>
                      </span>
                      <Icon name="arrow-right" size={18} className={styles.videoTestArrow} />
                    </Link>
                  </li>
                ) : null,
              )}
            </ul>
            {/* `PlatformBlockLink`, not a fifth hand-assembled copy of it. This
                one composed the right classes and still drifted, because the
                SHAPE was rebuilt here: when the shared crossing moved to the
                resting stroke this link kept the navigation strength and went
                on being invisible until hovered. Composing the styles is not
                the same as using the component. */}
            <span className={`${styles.videoDecisionMore} ${styles.videoDecisionMoreFoot}`}>
              <PlatformBlockLink href="/tests" label={allTestsLabel} />
            </span>
          </div>
        </aside>
      </div>
    </section>
  );
}
