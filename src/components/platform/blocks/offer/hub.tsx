import { PlatformOfferCard } from "@/components/platform/PlatformOfferCard";
import styles from "@/components/platform/PlatformOfferStyles";
import { featuredPrograms, miniCourses } from "@/lib/platform/content";

export function HubMini() {
  return (
    <section className={`${styles.container} ${styles.section} ${styles.sectionFlow}`} id="mini-courses">
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>М&apos;який вхід без довгого зобов&apos;язання</h2>
        </div>
      </div>
      <div className={styles.programShowcase} data-layout="mini">
        {miniCourses.map((program) => (
          <PlatformOfferCard
            key={program.slug}
            title={program.title}
            tag={program.tag}
            description={program.description}
            href={program.href}
            visual={program.visual}
            slug={program.slug}
            artwork={program.artwork}
            ctaLabel="Деталі курсу"
            size="compact"
          />
        ))}
      </div>
    </section>
  );
}

export function HubPrograms() {
  return (
    <section className={`${styles.container} ${styles.section} ${styles.sectionFlow}`} id="programs">
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Глибші програми для тіла, харчування і ритму</h2>
        </div>
      </div>
      <div className={styles.programShowcase}>
        {featuredPrograms.map((program) => (
          <PlatformOfferCard
            key={program.slug}
            title={program.title}
            tag={program.tag}
            description={program.description}
            href={program.href}
            visual={program.visual}
            slug={program.slug}
            artwork={program.artwork}
            ctaLabel="Деталі програми"
          />
        ))}
      </div>
    </section>
  );
}
