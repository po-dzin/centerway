/* Split out of DoshaTestClient on 2026-09-13. Owns the intro phase: the hero
   photo, the card that says what the test costs and what it is, the start
   button, and the disclosure with the method's boundaries. Stateless — the
   state and the start flow live in useDoshaAttempt. */

import Link from "next/link";
import { Icon } from "@/components/Icon";
import { InteractionInkLabel } from "@/components/platform/InteractionInk";
import styles from "@/components/platform/PlatformDiagnosticStyles";
import { BOUNDARY_NOTE, DOSHA_DISCLOSURE, HOW_IT_WORKS_STEPS } from "@/lib/dosha/doshaResultCopy";
import { PlatformHeroPhoto } from "@/components/platform/PlatformHeroPhoto";
import { heroFraming } from "@/components/platform/heroFraming";
import { platformPageArtwork } from "@/lib/platform/content";
import { TESTS_HUB_ROUTE } from "@/lib/platform/tests";

type DoshaIntroProps = {
  fontFamily: string;
  topbarBadge: string;
  error: string | null;
  isBusy: boolean;
  requestStartTest: () => Promise<void>;
};

export function DoshaIntro({ fontFamily, topbarBadge, error, isBusy, requestStartTest }: DoshaIntroProps) {
  const doshaHeroArtwork = platformPageArtwork.dosha;
  const heroStyle = heroFraming(doshaHeroArtwork);

  return (
    <section
      className={styles.heroFeature}
      data-cw-topbar-tone="dark"
      data-cw-detail-template="dosha"
      data-cw-semantic-role="diagnostic-entry"
      data-cw-semantic-family="guide-progress"
      data-cw-token-source="global-app-ds"
      data-dosha-test="true"
      data-dosha-phase="intro"
      style={heroStyle}
    >
      <div className={styles.heroPhotoLayer}>
        <PlatformHeroPhoto
          artwork={doshaHeroArtwork}
          alt="Доша-тест CenterWay: три доші — три матеріали"
          className={styles.expertImage}
          eager
        />
      </div>
      <div
        className={`${styles.heroFeatureContent} ${styles.diagnosticHeroContent}`}
        style={{
          fontFamily,
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        {/* Order is the whole point of this card. It used to read badge →
            eyebrow → title → four-line lead → a card of long steps → a card
            of legal boundaries, and only then the button — a page about
            starting something where starting was the last thing offered.
            Now: what it costs, what it is, start. Everything a person may
            want *before* deciding sits in one disclosure under the button,
            and the boundary note lives inside it rather than as its own
            panel — it was already repeated there. */}
        <article className={`${styles.panel} ${styles.diagnosticHeroCard}`}>
          <div className={styles.panelStack}>
            <div className={styles.panelIntro}>
              <p className={styles.heroBadge} data-cw-header-tone="dark">
                <span>{topbarBadge}</span>
              </p>
              <h1 className={styles.title}>Тест доші</h1>
              <p className={styles.lead}>
                Швидка самооцінка ритму, енергії, травлення і напруги — щоб побачити поточний стан і зрозуміти, з чого
                почати.
              </p>
            </div>

            <div className={styles.card} data-tone="proof">
              <p className={styles.label}>Як це працює</p>
              <ol className={styles.diagnosticNumberList}>
                {HOW_IT_WORKS_STEPS.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>

            {error ? <p className={styles.diagnosticErrorNote}>{error}</p> : null}

            <div className={styles.diagnosticActions}>
              <button
                type="button"
                onClick={() => {
                  void requestStartTest();
                }}
                disabled={isBusy}
                className={styles.primaryButton}
              >
                {isBusy ? "Запускаємо..." : "Почати тест"}
              </button>
            </div>

            {/* The DS collapsible (`details` + the surface summary with its
                +/− marker), not a text button: a disclosure and a link to
                another page were rendering as the same underlined line, so
                nothing said which one leaves the page. */}
            <details className={styles.collapsibleBlock}>
              <summary className={styles.collapsibleSummary}>
                <span>Що таке доша і межі методу</span>
                <Icon name="chevron-down" size={18} className={styles.collapsibleMarker} />
              </summary>
              <div className={styles.card} data-tone="support">
                <p>{DOSHA_DISCLOSURE}</p>
                <p>{BOUNDARY_NOTE}</p>
              </div>
            </details>

            <Link className={styles.diagnosticBackLink} href={TESTS_HUB_ROUTE} data-cw-ink-control>
              <Icon name="arrow-left" size={16} className={styles.diagnosticBackIcon} />
              <InteractionInkLabel variant="link">Усі тести</InteractionInkLabel>
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
}
