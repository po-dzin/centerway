import { PlatformBlock, PlatformBlockLink } from "@/components/platform/PlatformBlock";
import { PlatformOfferCard } from "@/components/platform/PlatformOfferCard";
import styles from "@/components/platform/PlatformOfferStyles";
import type { StorefrontCard } from "@/lib/platform/offers";

export function CourseNextStep({ currentSlug, courses }: { currentSlug: string; courses: StorefrontCard[] }) {
  const next = courses.filter((course) => course.slug !== currentSlug).slice(0, 6);
  if (next.length === 0) return null;
  return (
    <PlatformBlock
      id="next-course"
      label="Наступний крок"
      title="Продовжити шлях"
      lead="Оберіть матеріал, який відповідає вашому теперішньому ритму і запиту."
      headActions={<PlatformBlockLink href="/programs" label="Усі програми і курси" />}
    >
      <div className={styles.aggregateRail} data-layout={next.length === 1 ? "single" : undefined}>
        {next.map((course) => (
          <PlatformOfferCard key={course.slug} title={course.title} tag={course.tag}
            description={course.description} href={course.href} visual={course.visual}
            slug={course.slug} artwork={course.artwork} kindBadge={course.kindBadge}
            categories={course.categoryLabels} pretitle={course.pretitle} posttitle={course.posttitle}
            ctaLabel="Наступний крок" />
        ))}
      </div>
    </PlatformBlock>
  );
}
