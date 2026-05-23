import type { CSSProperties } from "react";
import Link from "next/link";
import styles from "@/components/platform/PlatformContentStyles";
import { educationTimeline, expertFacts, expertStory, personalFacts, platformPageArtwork } from "@/lib/platform/content";

function CollapsibleTimeline({
  items,
  initiallyVisible,
  summaryLabel,
}: {
  items: string[];
  initiallyVisible: number;
  summaryLabel: string;
}) {
  const visible = items.slice(0, initiallyVisible);
  const hidden = items.slice(initiallyVisible);

  return (
    <div className={styles.copyStack}>
      <ul className={`${styles.timeline} ${styles.timelineCompact}`}>
        {visible.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {hidden.length > 0 ? (
        <details className={styles.collapsibleBlock}>
          <summary className={styles.collapsibleSummary}>{summaryLabel}</summary>
          <ul className={`${styles.timeline} ${styles.timelineCompact} ${styles.collapsibleList}`}>
            {hidden.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

export function ExpertHero() {
  return (
    <section
      className={styles.heroFeature}
      id="about-author"
      data-cw-topbar-tone="dark"
      style={{
        "--hero-photo-x": "50%",
        "--hero-photo-y": "16%",
        "--hero-photo-shift-y": "0%",
        "--hero-photo-scale": "1.02",
        "--hero-photo-origin": "center top",
      } as CSSProperties}
    >
      <div className={styles.heroPhotoLayer}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.expertImage} src={platformPageArtwork.expert.desktop} alt="Про автора CenterWay" />
      </div>
      <div className={styles.heroFeatureContent}>
        <p className={styles.heroBadge}>
          <span>Автор · Практика · Шлях</span>
        </p>
        <h1 className={styles.heroFeatureTitle}>Про автора</h1>
        <p className={styles.heroFeatureLead}>{expertStory[0]}</p>
        <p className={styles.heroSupportNote}>12 років практики: аюрведа, дієтологія, детоксикація, йога і комплементарна медицина.</p>
        <div className={styles.heroFeatureActions}>
          <Link className={styles.heroPrimaryButton} href="#consultation">
            Запит на консультацію
          </Link>
          <Link className={styles.heroSecondaryButton} href="#expert-path">
            Освіта і шлях
          </Link>
        </div>
      </div>
    </section>
  );
}

export function ExpertProof() {
  return (
    <section className={`${styles.container} ${styles.section}`} id="expert-proof">
      <div className={`${styles.grid2} ${styles.profileGridPair}`}>
        <article className={`${styles.panel} ${styles.expertCompactPanel}`}>
          <p className={styles.label}>Профіль</p>
          <h2 className={styles.title}>Практика CenterWay</h2>
          <div className={styles.factGrid}>
            {expertFacts.map((fact) => (
              <span key={fact.label} data-icon={fact.icon}>{fact.label}</span>
            ))}
          </div>
        </article>
        <article className={`${styles.panel} ${styles.expertCompactPanel}`}>
          <p className={styles.label}>Особисто</p>
          <h2 className={styles.title}>Факти про мене</h2>
          <CollapsibleTimeline items={personalFacts} initiallyVisible={3} summaryLabel="Ще факти" />
        </article>
      </div>
    </section>
  );
}

export function ExpertPath() {
  return (
    <section className={`${styles.container} ${styles.section}`} id="expert-path">
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.label}>Освіта і шлях</p>
          <h2 className={styles.sectionTitle}>Від технічної освіти до системи CenterWay</h2>
        </div>
      </div>
      <article className={`${styles.panel} ${styles.expertCompactPanel}`}>
        <CollapsibleTimeline items={educationTimeline} initiallyVisible={4} summaryLabel="Показати весь шлях" />
      </article>
    </section>
  );
}
