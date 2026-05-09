import Link from "next/link";
import styles from "@/components/platform/PlatformStyles";
import { educationTimeline, expertFacts, expertStory, personalFacts } from "@/lib/platform/content";
import { getFunnelHostUrl } from "@/lib/surfaces/catalog";

const consultFunnelHref = getFunnelHostUrl("consult") ?? "/consult";

export function ExpertHero() {
  return (
    <section className={`${styles.container} ${styles.hero}`} id="about-author">
      <div className={styles.heroPanel}>
        <div>
          <p className={styles.eyebrow}>Про автора</p>
          <h1 className={styles.heroTitle}>Євгеній Корякін</h1>
        </div>
        <div className={styles.copyStack}>
          {expertStory.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <div className={styles.heroFooter}>
          <Link className={styles.primaryButton} href={consultFunnelHref}>
            Запит на консультацію
          </Link>
          <Link className={styles.secondaryButton} href="/#programs">
            Програми
          </Link>
        </div>
      </div>
      <aside className={styles.mediaPanel}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.expertImage} src="/cw/landing/img/consult-hero-evgeniy.jpeg" alt="Євгеній Корякін" />
        <div className={styles.mediaCaption}>
          <strong>12 років практики</strong>
          <span>Аюрведа, дієтологія, детоксикація, йога і комплементарна медицина.</span>
        </div>
      </aside>
    </section>
  );
}

export function ExpertProof() {
  return (
    <section className={`${styles.container} ${styles.section}`}>
      <div className={styles.grid2}>
        <article className={styles.panel}>
          <p className={styles.label}>Профіль</p>
          <h2 className={styles.title}>Практика CenterWay</h2>
          <div className={styles.factGrid}>
            {expertFacts.map((fact) => (
              <span key={fact.label} data-icon={fact.icon}>{fact.label}</span>
            ))}
          </div>
        </article>
        <article className={styles.panel}>
          <p className={styles.label}>Особисто</p>
          <h2 className={styles.title}>Факти про мене</h2>
          <ul className={styles.timeline}>
            {personalFacts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}

export function ExpertPath() {
  return (
    <section className={`${styles.container} ${styles.section}`}>
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.label}>Освіта і шлях</p>
          <h2 className={styles.sectionTitle}>Від технічної освіти до системи CenterWay</h2>
        </div>
      </div>
      <ol className={styles.timeline}>
        {educationTimeline.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    </section>
  );
}
