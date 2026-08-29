import Link from "next/link";
import styles from "@/components/platform/PlatformTrustStyles";
import { Icon } from "@/components/Icon";
import { heroFraming } from "@/components/platform/heroFraming";
import { educationTimeline, expertFacts, expertStory, platformPageArtwork } from "@/lib/platform/content";

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
          <summary className={styles.collapsibleSummary}>
            <span>{summaryLabel}</span>
            <Icon name="chevron-down" size={18} className={styles.collapsibleMarker} />
          </summary>
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
      style={heroFraming(platformPageArtwork.expert)}
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
    <section
      className={`${styles.container} ${styles.section}`}
      data-cw-semantic-role="identity-guide"
      data-cw-semantic-family="trust-identity"
      data-cw-token-source="global-app-ds"
      data-cw-user-question="Хто проводить консультацію і чому йому можна довіряти?"
      data-cw-route-boundary="platform:/consult"
      id="expert-proof"
    >
      <div className={`${styles.authorPanel} ${styles.authorPanelStacked}`}>
        <div className={styles.authorCardMedia}>
          {/* The same portrait and crop recipe as the author block on the
              platform home. Identity should not change between surfaces. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.authorPortrait}
            src="/shared/img/author-evgeniy-2026-08.webp"
            width={1040}
            height={1280}
            loading="lazy"
            decoding="async"
            alt="Євгеній Корякін — засновник CenterWay"
          />
        </div>
        <div className={styles.authorPanelContent}>
          <div>
            <p className={styles.label}>Провідник</p>
            <h2 className={styles.title}>Євгеній Корякін</h2>
          </div>
          <p className={styles.lead}>{expertStory[0]}</p>
          <div className={styles.factGrid}>
            {expertFacts.map((fact) => (
              <span key={fact.label}>
                <Icon name={fact.icon} size={20} className={styles.factIcon} />
                {fact.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function ExpertPath() {
  return (
    <section
      className={`${styles.container} ${styles.section}`}
      data-cw-semantic-role="proof"
      data-cw-semantic-family="trust-proof"
      data-cw-token-source="global-app-ds"
      data-cw-user-question="Який досвід стоїть за підходом CenterWay?"
      data-cw-route-boundary="platform:/consult"
      id="expert-path"
    >
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
