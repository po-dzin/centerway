import { PlatformOfferCard } from "@/components/platform/PlatformOfferCard";
import { PlatformOfferCarousel } from "@/components/platform/PlatformOfferCarousel";
import { PlatformBlock, PlatformBlockLink } from "@/components/platform/PlatformBlock";
import { listStorefrontCourses } from "@/lib/platform/offers";

/**
 * The home page's two shelves.
 *
 * WHY THESE READ THE DATABASE NOW. Reset Day left content.ts when its page
 * became a `/programs/[slug]` route served from the builder — and it left the
 * home page with it, because these blocks knew only the six TypeScript
 * literals. A course that a stranger can find in the catalogue and cannot find
 * on the front page is not published, it is hidden with extra steps.
 *
 * Same rule as the catalogue (`PlatformProgramsIndexPage`), and since
 * 2026-08-29 there is nothing left to merge: the last hand-written course left
 * `content.ts` with reboot and irem, so both shelves are the database in the
 * author's own `sortOrder`.
 *
 * Never throws — `listStorefrontCourses` answers `[]` when the database is
 * unreachable, and the home page keeps its static half.
 */
const MINI_LESSON_CEILING = 8;

export async function HubMini() {
  const authored = (await listStorefrontCourses()).filter((course) => course.lessons <= MINI_LESSON_CEILING);

  return (
    <PlatformBlock
      id="mini-courses"
      label="Міні-курси"
      title="М&apos;який вхід без довгого зобов&apos;язання"
      lead="Кілька днів практики, щоб спробувати підхід без довгого зобов'язання."
      headActions={<PlatformBlockLink href="/programs" label="Усі матеріали" />}
    >
      <PlatformOfferCarousel label="Міні-курси CenterWay">
        {authored.map((course) => (
          <PlatformOfferCard
            key={course.slug}
            title={course.title}
            tag={course.tag}
            description={course.description}
            href={course.href}
            visual={course.visual}
            slug={course.slug}
            artwork={course.artwork}
            kindBadge={course.kindBadge}
            categories={course.categoryLabels}
            pretitle={course.pretitle}
            posttitle={course.posttitle}
            commercialMode={course.commercialMode}
            price={course.price}
            compareAtPrice={course.compareAtPrice}
            ctaLabel="Деталі курсу"
          />
        ))}
      </PlatformOfferCarousel>
    </PlatformBlock>
  );
}

export async function HubPrograms() {
  const authored = (await listStorefrontCourses()).filter((course) => course.lessons > MINI_LESSON_CEILING);

  return (
    <PlatformBlock
      id="programs"
      label="Програми"
      title="Глибші формати для тіла, харчування і ритму"
      lead="Що обрати для свого поточного стану?"
      headActions={<PlatformBlockLink href="/programs" label="Усі матеріали" />}
    >
      <PlatformOfferCarousel label="Програми CenterWay">
        {authored.map((course) => (
          <PlatformOfferCard
            key={course.slug}
            title={course.title}
            tag={course.tag}
            description={course.description}
            href={course.href}
            visual={course.visual}
            slug={course.slug}
            artwork={course.artwork}
            kindBadge={course.kindBadge}
            categories={course.categoryLabels}
            pretitle={course.pretitle}
            posttitle={course.posttitle}
            commercialMode={course.commercialMode}
            price={course.price}
            compareAtPrice={course.compareAtPrice}
            ctaLabel="Переглянути деталі"
          />
        ))}
      </PlatformOfferCarousel>
    </PlatformBlock>
  );
}
