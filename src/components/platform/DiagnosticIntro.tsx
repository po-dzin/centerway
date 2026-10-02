/* The intro of a test — one object for every test on the platform.
   The dosha test and the balance test had each their own copy of this screen,
   and both had grown the same way: a card of numbered steps that repeated the
   format badge and the lead, a disclosure, a second card for the author. A
   person deciding whether to spend three minutes needs five things, and this
   screen shows exactly those — what it is (title, lead), how long (badge),
   whose it is (byline), and the button. (A «Безкоштовно · без реєстрації» line
   stood beside the button for a day and was taken out on 2026-09-30: a free
   test says so by having no price, and the end of the flow does offer an
   account — to keep the result — so «no registration» promised more than it
   meant.) Everything else — how it works, what it is not, the limits of the
   method — sits in ONE disclosure, closed, for the person who wants it. */

import Link from "next/link";
import { Icon } from "@/components/Icon";
import { AuthorByline } from "@/components/platform/AuthorByline";
import { InteractionInkLabel } from "@/components/platform/InteractionInk";
import styles from "@/components/platform/PlatformDiagnosticStyles";
import { PlatformHeroPhoto } from "@/components/platform/PlatformHeroPhoto";
import { heroFraming } from "@/components/platform/heroFraming";
import type { PlatformOfferArtwork } from "@/lib/platform/content";
import { TESTS_HUB_ROUTE } from "@/lib/platform/tests";
import type { Author } from "@/lms-core";

type DiagnosticIntroProps = {
  artwork: PlatformOfferArtwork;
  imageAlt: string;
  /** The test's own phase attribute — `data-dosha-phase` or `data-balance-phase`. */
  phaseAttribute: "data-dosha-phase" | "data-balance-phase";
  fontFamily: string;
  /** «12 питань • 3-5 хв» — the format, on the badge. */
  badge: string;
  title: string;
  /** One or two sentences: what the person will learn. */
  lead: string;
  /** Whose test this is. Null prints nothing: an unclaimed test must not borrow a face. */
  author: Author | null;
  /** The disclosure's steps, one line each. */
  steps: readonly string[];
  /** What this test is, and what it is not — paragraphs, in the disclosure. */
  notes: readonly string[];
  /** The method's limit, last in the disclosure. */
  boundary: string;
  error?: string | null;
  isBusy?: boolean;
  onStart: () => void;
  /**
   * An unfinished run in this browser. The intro then offers the way back in
   * first — «Продовжити з питання N» — and starting over as the quiet second
   * choice, instead of dropping the reader mid-test without asking (the dosha
   * test used to) or forgetting the answers on a reload (the balance test did).
   */
  resume?: { question: number; total: number; onResume: () => void } | null;
};

export function DiagnosticIntro({
  artwork,
  imageAlt,
  phaseAttribute,
  fontFamily,
  badge,
  title,
  lead,
  author,
  steps,
  notes,
  boundary,
  error = null,
  isBusy = false,
  onStart,
  resume = null,
}: DiagnosticIntroProps) {
  const phase = { [phaseAttribute]: "intro" };

  return (
    <section
      className={styles.heroFeature}
      data-cw-topbar-tone="dark"
      data-cw-detail-template="dosha"
      data-cw-semantic-role="diagnostic-entry"
      data-cw-semantic-family="guide-progress"
      data-cw-token-source="global-app-ds"
      data-dosha-test="true"
      {...phase}
      style={heroFraming(artwork)}
    >
      <div className={styles.heroPhotoLayer}>
        <PlatformHeroPhoto artwork={artwork} alt={imageAlt} className={styles.expertImage} eager />
      </div>
      <div
        className={`${styles.heroFeatureContent} ${styles.diagnosticHeroContent}`}
        style={{ fontFamily, userSelect: "none", WebkitUserSelect: "none" }}
      >
        <article className={`${styles.panel} ${styles.diagnosticHeroCard}`}>
          <div className={styles.panelStack}>
            <div className={styles.panelIntro}>
              <p className={styles.heroBadge} data-cw-header-tone="dark">
                <span>{badge}</span>
              </p>
              <h1 className={styles.title}>{title}</h1>
              {author ? <AuthorByline author={author} /> : null}
              <p className={styles.lead}>{lead}</p>
            </div>

            {error ? <p className={styles.diagnosticErrorNote}>{error}</p> : null}

            {/* THE TWO CHOICES ARE ONE PAIR (2026-10-02). «Почати заново» was a
                text link standing alone between the button and the disclosure,
                reading as a stray third thing rather than the other half of the
                question «continue or start over?». It is the secondary of a
                pair now — the same pair the result's next step uses: side by
                side where they fit, stacked full width on a phone. */}
            {resume ? (
              <div className={styles.diagnosticResultActions}>
                <button type="button" onClick={resume.onResume} disabled={isBusy} className={styles.primaryButton}>
                  {isBusy ? "Відкриваємо..." : `Продовжити з питання ${resume.question}`}
                </button>
                <button type="button" onClick={onStart} disabled={isBusy} className={styles.secondaryButton}>
                  Почати заново
                </button>
              </div>
            ) : (
              <div className={styles.diagnosticActions}>
                <button type="button" onClick={onStart} disabled={isBusy} className={styles.primaryButton}>
                  {isBusy ? "Запускаємо..." : "Почати тест"}
                </button>
              </div>
            )}

            {/* Not for a reader coming back mid-test: they have read how it
                works once already, and the screen's only question now is
                «continue or start over?». */}
            {resume ? null : (
              <details className={styles.collapsibleBlock}>
                <summary className={styles.collapsibleSummary}>
                  <span>Як це працює і межі методу</span>
                  <Icon name="chevron-down" size={18} className={styles.collapsibleMarker} />
                </summary>
                <div className={styles.card} data-tone="support">
                  <ol className={styles.diagnosticNumberList}>
                    {steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  {notes.map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                  <p className={styles.diagnosticScoreRow}>{boundary}</p>
                </div>
              </details>
            )}

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
