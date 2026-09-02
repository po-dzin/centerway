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

/**
 * WHAT COSTS NOTHING — the shelf a reader who has not decided anything can open.
 *
 * `commercialMode === "free"` and nothing else. Not "cheap", not "no price
 * set": a course whose owner has agreed a price of zero, which the catalogue
 * contract keeps strictly apart from «ціна за запитом» — an offer nobody has
 * priced is not free, it is unanswered. The same distinction the catalogue's
 * price filter makes (`catalogQuery.ts`), applied here as a fixed question.
 *
 * SILENT WHEN EMPTY. A block whose rail has no cards is a heading over a hole,
 * and this one is entirely possible to empty: the day the last free course is
 * priced, the section should disappear rather than announce an absence.
 */
export async function HubFree() {
  const free = (await listStorefrontCourses()).filter((course) => course.commercialMode === "free");
  if (free.length === 0) return null;

  return (
    <PlatformBlock
      id="free-materials"
      label="Безкоштовні матеріали"
      title="З чого можна почати, нічого не витрачаючи"
      lead="Короткі матеріали, відкриті повністю — щоб побачити підхід зсередини, а не з опису."
      headActions={<PlatformBlockLink href="/programs?free=1" label="Усі безкоштовні" />}
    >
      <PlatformOfferCarousel label="Безкоштовні матеріали CenterWay">
        {free.map((course) => (
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
            ctaLabel="Відкрити"
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
