import { PlatformBlock, PlatformBlockLink } from "@/components/platform/PlatformBlock";
import { PlatformOfferCard } from "@/components/platform/PlatformOfferCard";
import { PlatformOfferCarousel } from "@/components/platform/PlatformOfferCarousel";
import type { StorefrontCard } from "@/lib/platform/offers";

export function CourseNextStep({ currentSlug, courses }: { currentSlug: string; courses: StorefrontCard[] }) {
  const next = courses.filter((course) => course.slug !== currentSlug);
  if (next.length === 0) return null;
  return (
    <PlatformBlock
      id="next-course"
      label="Наступний крок"
      title="Продовжити шлях"
      lead="Оберіть матеріал, який відповідає вашому теперішньому ритму і запиту."
      headActions={<PlatformBlockLink href="/programs" label="Усі курси" />}
    >
      {/* Recommendations are a sample, never a catalogue: keep every card on
          one horizontal rail at every viewport. `PlatformOfferCard` owns one
          whole-card link, so both the card body and its visible CTA open the
          same destination without creating duplicate tab stops. */}
      <PlatformOfferCarousel label="Рекомендовані курси">
        {next.map((course) => (
          <PlatformOfferCard key={course.slug} title={course.title} tag={course.tag}
            description={course.description} href={course.href} visual={course.visual}
            slug={course.slug} artwork={course.artwork} kindBadge={course.kindBadge}
            categories={course.categoryLabels} pretitle={course.pretitle} posttitle={course.posttitle}
            commercialMode={course.commercialMode} price={course.price} compareAtPrice={course.compareAtPrice}
            ctaLabel="Наступний крок" />
        ))}
      </PlatformOfferCarousel>
    </PlatformBlock>
  );
}
