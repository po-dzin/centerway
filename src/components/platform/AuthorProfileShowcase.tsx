import { Icon } from "@/components/Icon";
import { PlatformOfferCard } from "@/components/platform/PlatformOfferCard";
import { PlatformOfferCarousel } from "@/components/platform/PlatformOfferCarousel";
import type { StorefrontCard } from "@/lib/platform/offers";
import type { Author } from "@/lms-core";
import { PlatformBlockLink } from "@/components/platform/PlatformBlock";
import { AuthorPortrait } from "./AuthorPortrait";
import styles from "./AuthorProfileShowcase.module.css";
import { ConsultBoundary, ConsultFaq } from "@/components/platform/ConsultPageSections";
import { consultationSteps } from "@/components/platform/consultPageContract";
import { AUTHOR_BANNER_CROP_DEFAULT } from "@/lib/lms/authorPhoto";
import { cropBackgroundStyle } from "@/lib/media/imageCrop";
import Link from "next/link";
import { InteractionInkLabel } from "@/components/platform/InteractionInk";
import { FeedView } from "@/components/platform/feed/FeedView";
import feedStyles from "@/components/platform/feed/Feed.module.css";
import type { FeedPage } from "@/lib/feed/server";

/**
 * THE AUTHOR'S PAGE IN TABS (G, 16.10 «да, давай вкладки в публичной
 * странице»). The header stays on every tab; below it three rooms:
 * «Програми і продукти» — the courses and, when the author takes them, the
 * consultation (a consultation is something you can take from them, and the
 * hubs send people here to book it, so it lives on the tab a link opens by
 * default); «Дописи» — the author's own posts from «Стрічка»; «Про мене» — the
 * biography, facts and profile blocks. «Портфоліо» waits for its own mockup.
 *
 * A tab is an address (`?tab=posts`), so a link can open the posts directly
 * and the back button walks between them. A tab with nothing in it is not
 * offered.
 */
export type AuthorTab = "programs" | "posts" | "about";

export function authorTabOf(raw: string | string[] | undefined): AuthorTab {
  return raw === "posts" || raw === "about" ? raw : "programs";
}

function courseCountLabel(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} курс`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} курси`;
  return `${count} курсів`;
}

/** Public author identity and course showcase. */
export function AuthorProfileShowcase({
  author,
  courses,
  tab = "programs",
  posts = { posts: [], next: null },
}: {
  author: Author;
  courses: StorefrontCard[];
  tab?: AuthorTab;
  posts?: FeedPage;
}) {
  /* The header's small facts, in one list because they end up in one row. */
  const meta = [courseCountLabel(courses.length), author.experienceBadge, author.achievementBadge].filter(
    (fact): fact is string => Boolean(fact),
  );

  const hasAbout = Boolean(
    author.bio || author.quote || author.credentials?.length || author.facts?.length || author.profileBlocks?.length,
  );
  const tabs = [
    { key: "programs" as const, label: "Програми і продукти" },
    ...(posts.posts.length > 0 ? [{ key: "posts" as const, label: "Дописи" }] : []),
    ...(hasAbout ? [{ key: "about" as const, label: "Про мене" }] : []),
  ];
  const current: AuthorTab = tabs.some((entry) => entry.key === tab) ? tab : "programs";
  const base = `/expert/${author.slug}`;

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
      </header>

      {tabs.length > 1 ? (
        <nav className={`${feedStyles.tabs} ${styles.tabs}`} aria-label="Розділи автора">
          {tabs.map((entry) => (
            <Link
              key={entry.key}
              className={`cw-nav-link ${feedStyles.tab}`}
              data-cw-ink-control=""
              href={entry.key === "programs" ? base : `${base}?tab=${entry.key}`}
              aria-current={entry.key === current ? "page" : undefined}
              scroll={false}
            >
              <InteractionInkLabel variant="tab" active={entry.key === current}>
                {entry.label}
              </InteractionInkLabel>
            </Link>
          ))}
        </nav>
      ) : null}

      {current === "programs" ? (
        <>
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
          {author.consultation?.enabled ? (
            <section className={styles.consultation} id="consultation">
              {/* No eyebrow: the heading already carries the word. When the author
            leaves the title empty it falls back to «Консультація з …», and
            when they write their own, their word is the better one. Either
            way the eyebrow was never the best available line. */}
              <h2 className={styles.courseTitle}>{author.consultation.title || `Консультація з ${author.name}`}</h2>
              {author.consultation.summary ? <p className={styles.bio}>{author.consultation.summary}</p> : null}
              {author.consultation.points?.length ? (
                <ul className={styles.credentials}>
                  {author.consultation.points.map((point) => (
                    <li className={styles.credential} key={point}>
                      <Icon name="check" size={20} />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <h2 className={styles.courseTitle}>Як це відбувається</h2>
              <ol className={styles.steps}>
                {consultationSteps.map((step) => (
                  <li key={step.id}>
                    <strong>{step.title}</strong>
                    <span>{step.text}</span>
                  </li>
                ))}
              </ol>
              {author.consultation.contactUrl ? (
                <a
                  className={styles.consultationAction}
                  href={author.consultation.contactUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Домовитися про консультацію
                </a>
              ) : null}
            </section>
          ) : null}
          {/* The author's route, not the consultation page's — these two sections
          render on both, and they used to declare `/consult` here. */}
          {author.consultation?.enabled ? (
            <>
              <ConsultBoundary route="platform:/expert/[slug]" />
              <ConsultFaq route="platform:/expert/[slug]" />
            </>
          ) : null}
        </>
      ) : null}

      {current === "posts" ? (
        <section className={styles.profileSection} aria-label="Дописи автора">
          <FeedView initial={posts} authors={[]} filter={{ topics: [], authors: [author.slug] }} mode="author" />
        </section>
      ) : null}

      {current === "about" ? (
        <>
          {author.bio || author.quote || author.credentials?.length ? (
            <section className={styles.profileSection}>
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
            </section>
          ) : null}

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
        </>
      ) : null}
    </main>
  );
}
