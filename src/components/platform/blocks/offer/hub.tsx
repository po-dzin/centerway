import { PlatformOfferCard } from "@/components/platform/PlatformOfferCard";
import { PlatformBlock, PlatformBlockLink } from "@/components/platform/PlatformBlock";
import styles from "@/components/platform/PlatformOfferStyles";
import { featuredPrograms, miniCourses } from "@/lib/platform/content";
import { listStorefrontCourses } from "@/lib/platform/offers";
import { offerEyebrow } from "@/lib/platform/offerPreview";

/**
 * The home page's two shelves.
 *
 * WHY THESE READ THE DATABASE NOW. Reset Day left content.ts when its page
 * became a `/programs/[slug]` route served from the builder — and it left the
 * home page with it, because these blocks knew only the six TypeScript
 * literals. A course that a stranger can find in the catalogue and cannot find
 * on the front page is not published, it is hidden with extra steps.
 *
 * Same rule as the catalogue (`PlatformProgramsIndexPage`): the split a reader
 * cares about is how much of their life the thing asks for, not which of the
 * two places it was typed into. The authored courses lead each rail because
 * their order is the author's own; the hand-written six follow.
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
      headActions={<PlatformBlockLink href="/programs" label="Усі програми і курси" />}
    >
      <div className={styles.programShowcase} data-layout="mini">
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
            ctaLabel="Деталі курсу"
          />
        ))}
        {miniCourses.map((program) => (
          <PlatformOfferCard
            key={program.slug}
            title={program.title}
            tag={offerEyebrow(program.tag, program.duration)}
            description={program.description}
            href={program.href}
            visual={program.visual}
            slug={program.slug}
            artwork={program.artwork}
            ctaLabel="Деталі курсу"
          />
        ))}
      </div>
    </PlatformBlock>
  );
}

export async function HubPrograms() {
  const authored = (await listStorefrontCourses()).filter((course) => course.lessons > MINI_LESSON_CEILING);

  return (
    <PlatformBlock
      id="programs"
      label="Програми"
      title="Глибші програми для тіла, харчування і ритму"
      lead="Яка програма підходить моєму поточному стану?"
      headActions={<PlatformBlockLink href="/programs" label="Усі програми" />}
    >
      <div className={styles.programShowcase}>
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
            ctaLabel="Деталі програми"
          />
        ))}
        {featuredPrograms.map((program) => (
          <PlatformOfferCard
            key={program.slug}
            title={program.title}
            tag={offerEyebrow(program.tag, program.duration)}
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
