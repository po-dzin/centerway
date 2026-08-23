import { PlatformOfferCard } from "@/components/platform/PlatformOfferCard";
import { PlatformBlock, PlatformBlockLink } from "@/components/platform/PlatformBlock";
import styles from "@/components/platform/PlatformOfferStyles";
import { featuredPrograms, miniCourses } from "@/lib/platform/content";

export function HubMini() {
  return (
    <PlatformBlock
      id="mini-courses"
      label="Міні-курси"
      title="М&apos;який вхід без довгого зобов&apos;язання"
      lead="Кілька днів практики, щоб спробувати підхід без довгого зобов'язання."
      headActions={<PlatformBlockLink href="/programs" label="Усі програми і курси" />}
    >
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
    </PlatformBlock>
  );
}

export function HubPrograms() {
  return (
    <PlatformBlock
      id="programs"
      label="Програми"
      title="Глибші програми для тіла, харчування і ритму"
      lead="Яка програма підходить моєму поточному стану?"
      headActions={<PlatformBlockLink href="/programs" label="Усі програми" />}
    >
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
    </PlatformBlock>
  );
}
