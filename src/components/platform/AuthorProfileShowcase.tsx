import { Icon } from "@/components/Icon";
import { PlatformOfferCard } from "@/components/platform/PlatformOfferCard";
import { PlatformOfferCarousel } from "@/components/platform/PlatformOfferCarousel";
import type { StorefrontCard } from "@/lib/platform/offers";
import type { Author } from "@/lms-core";
import { PlatformBlockLink } from "@/components/platform/PlatformBlock";
import { AuthorPortrait } from "./AuthorPortrait";
import styles from "./AuthorProfileShowcase.module.css";
import { AuthorConsultation } from "@/components/platform/AuthorConsultation";
import { AUTHOR_BANNER_CROP_DEFAULT } from "@/lib/lms/authorPhoto";
import { cropBackgroundStyle } from "@/lib/media/imageCrop";

function courseCountLabel(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} курс`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} курси`;
  return `${count} курсів`;
}

/** Public author identity and course showcase. */
export function AuthorProfileShowcase({ author, courses }: { author: Author; courses: StorefrontCard[] }) {
  /* The header's small facts, in one list because they end up in one row. */
  const meta = [courseCountLabel(courses.length), author.experienceBadge, author.achievementBadge].filter(
    (fact): fact is string => Boolean(fact),
  );

  return (
    <main>
      {author.background ? (
        /* A FRAME AND A LAYER, not one div. The backdrop can be zoomed now, and
           a zoom is a transform on the layer — which needs something to clip
           it, or the picture grows past the band's own rounded edge and over
           the page. The frame holds the size, the margin and the radius; the
           layer holds the photograph and the crop. */
        <div className={styles.bannerFrame} aria-hidden="true">
          <div
            className={styles.banner}
            style={{
              backgroundImage: `url("${author.background.src}")`,
              ...cropBackgroundStyle(
                { x: author.background.cropX, y: author.background.cropY, scale: author.background.cropScale },
                AUTHOR_BANNER_CROP_DEFAULT,
              ),
            }}
          />
        </div>
      ) : null}
      <header className={author.background ? `${styles.hero} ${styles.heroWithBanner}` : styles.hero}>
        <div className={styles.identity}>
          <AuthorPortrait photo={author.photo} size="lg" fallback={author.name.trim().charAt(0).toUpperCase()} />
          <div className={styles.identityCopy}>
            {/* No eyebrow. The portrait is beside it and the name is the H1:
                a line reading «Профіль автора» over a face and a name told
                the reader only what they were already looking at. */}
            <h1 className={styles.name}>{author.name}</h1>
            {author.role ? <p className={styles.role}>{author.role}</p> : null}
            {/* ONE META ROW, and it is the shape every profile header worth
                copying uses: a face, a name, one line of who this is, then one
                row of small facts. This page had the count inline after the
                role and the two badges in a grid row of their own — three
                tokens of the same kind on two lines with two left edges, and on
                a phone the second row jumped to the header's outer edge while
                the first stayed indented past the portrait.

                Order is count first: it is the fact about THIS page (how much
                is here), and the credentials are claims about the person. */}
            {meta.length > 0 ? (
              <div className={styles.meta}>
                {meta.map((fact) => (
                  <span className={styles.chip} key={fact}>
                    {fact}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className={styles.body}>
          {author.bio ? <p className={styles.bio}>{author.bio}</p> : null}
          {author.quote ? <p className={styles.quote}>«{author.quote}»</p> : null}
          {author.credentials && author.credentials.length > 0 ? (
            <ul className={styles.credentials}>
              {author.credentials.map((line) => (
                <li className={styles.credential} key={line}>
                  <Icon name="star" size={20} />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </header>

      {author.facts?.length ? (
        <section className={styles.profileSection}>
          <div className={styles.sectionHeader}>
            {/* Two lines said one thing: «Коротко про автора» and «Досвід і
                головні орієнтири» name the same list. The heading is the more
                specific of the two, so it is the one that stays. */}
            <h2 className={styles.courseTitle}>Досвід і головні орієнтири</h2>
          </div>
          <ul className={styles.factGrid}>
            {author.facts.map((line) => (
              <li key={line}>
                <Icon name="star" size={20} />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {author.profileBlocks?.map((block) => (
        <section className={styles.profileSection} key={block.id}>
          <div className={styles.sectionHeader}>
            {block.label ? <p className={styles.label}>{block.label}</p> : null}
            <h2 className={styles.courseTitle}>{block.title}</h2>
          </div>
          <div className={styles.profilePanel}>
            {block.body
              ? block.body.split(/\n{2,}/).map((paragraph) => (
                  <p className={styles.profileParagraph} key={paragraph}>
                    {paragraph}
                  </p>
                ))
              : null}
            {block.items?.length && block.kind === "timeline" ? (
              <>
                <ul className={styles.timelineList}>
                  {block.items.slice(0, 4).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                {block.items.length > 4 ? (
                  <details className={styles.timelineMore}>
                    <summary>Показати весь шлях</summary>
                    <ul className={styles.timelineList}>
                      {block.items.slice(4).map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </>
            ) : block.items?.length ? (
              <ul className={styles.credentials}>
                {block.items.map((item) => (
                  <li className={styles.credential} key={item}>
                    <Icon name="star" size={20} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      ))}

      {/* The consultation and its request form — its own component so the
          author page's layout and the request flow change apart. */}
      <AuthorConsultation author={author} />

      <section className={styles.courses}>
        {/* The crossing sits in the head, beside the title — the same place and
            the same component every showcase block on the home page uses. It
            used to ride in the carousel's own footer, under the rail, which is
            both a second shape for one act and the wrong moment: a reader who
            has scrolled to the end of the cards has already stopped asking
            whether there are more. Printed only when there is a rail to be a
            sample OF. */}
        <div className={styles.courseHeader}>
          <div>
            <h2 className={styles.courseTitle}>Курси автора</h2>
          </div>
          {courses.length > 0 ? <PlatformBlockLink href="/programs" label="Усі курси" /> : null}
        </div>
        {courses.length > 0 ? (
          <PlatformOfferCarousel label={`Курси автора ${author.name}`}>
            {courses.map((course) => (
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
                categoryCodes={course.categories}
                pretitle={course.pretitle}
                commercialMode={course.commercialMode}
                price={course.price}
                compareAtPrice={course.compareAtPrice}
                highlight={course.highlight}
              />
            ))}
          </PlatformOfferCarousel>
        ) : (
          <p className={styles.empty}>Публічних курсів цього автора поки немає.</p>
        )}
      </section>
    </main>
  );
}
