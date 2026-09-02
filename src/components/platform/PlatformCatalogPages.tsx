import Link from "next/link";
import { PlatformShell } from "@/components/platform/PlatformLayout";
import { PlatformOfferCard } from "@/components/platform/PlatformOfferCard";
import { PlatformOfferCarousel } from "@/components/platform/PlatformOfferCarousel";
import heroStyles from "@/components/platform/PlatformHeroStyles";
import offerStyles from "@/components/platform/PlatformOfferStyles";
import { PlatformHeroPhoto } from "@/components/platform/PlatformHeroPhoto";
import { heroFraming } from "@/components/platform/heroFraming";
import { platformAggregateArtwork, platformPageArtwork, platformProductOffers } from "@/lib/platform/content";
import { activePlatformTests, plannedPlatformTests, testsHubCopy } from "@/lib/platform/tests";
import { listStorefrontCourses, type StorefrontCard } from "@/lib/platform/offers";
import { PlatformCatalogBrowser, type CatalogEntry } from "@/components/platform/PlatformCatalogBrowser";
import { offerEyebrow } from "@/lib/platform/offerPreview";
import { getPlatformRoute } from "@/lib/surfaces/catalog";

/**
 * The catalogue, no longer six constants — and since 2026-08-29, no constants.
 *
 * The catalogue used to split authored courses into two carousel rails. Both
 * rails read from the same source and asked the same comparison question, so
 * the aggregate now keeps every listed course in one continuous catalogue,
 * ordered by the author's own `sortOrder` and addressed by its program slug.
 *
 * Before the catalogue was database-backed, it merged authored courses with
 * the hand-written entries in
 * `content.ts`, because both kinds existed and a buyer does not care which of
 * them was typed into a TS file. The last course left that array with reboot
 * and irem, so the merge has nothing left to merge: every card here is a
 * published, `listed` course read through `listStorefrontCourses`, ordered by
 * the author's own `sortOrder`, and addressed by its program slug.
 *
 * Depth remains visible on each card through its kind and lesson count; it no
 * longer hides part of the full set behind a second sequential carrier.
 */
/**
 * One listed course, as the browser's two halves see it.
 *
 * The `filter` half is codes and figures; the `card` half is the card this
 * surface already rendered, unchanged. Written once here because the home
 * page's free shelf and the products rail ask for the same pair — and a second
 * copy of it would be a second opinion about which words a search may match.
 */
export function storefrontEntry(course: StorefrontCard): CatalogEntry {
  return {
    key: course.slug,
    filter: {
      title: course.title,
      description: course.description,
      keywords: [
        ...(course.categoryLabels ?? []),
        ...(course.kindBadge ? [course.kindBadge] : []),
        ...(course.pretitle ? [course.pretitle] : []),
        ...(course.posttitle ? [course.posttitle] : []),
      ],
      ...(course.categories ? { categories: course.categories } : {}),
      ...(course.kind ? { kind: course.kind } : {}),
      amount: course.amount,
    },
    card: {
      title: course.title,
      tag: course.tag,
      description: course.description,
      href: course.href,
      visual: course.visual,
      slug: course.slug,
      artwork: course.artwork,
      kindBadge: course.kindBadge,
      categories: course.categoryLabels,
      pretitle: course.pretitle,
      posttitle: course.posttitle,
      commercialMode: course.commercialMode,
      price: course.price,
      compareAtPrice: course.compareAtPrice,
      ctaLabel: course.lessons <= 8 ? "Деталі курсу" : "Деталі програми",
    },
  };
}

/**
 * The currency the interval is typed in. One catalogue, one currency today; the
 * first priced offer answers for it rather than the filter inventing a symbol.
 */
export function catalogCurrency(courses: readonly StorefrontCard[]): string | null {
  return courses.find((course) => course.currency)?.currency ?? null;
}

export async function PlatformProgramsIndexPage() {
  const authored = await listStorefrontCourses();

  const heroStyle = heroFraming(platformAggregateArtwork.programs);

  return (
    <PlatformShell headerMode="overlay">
      <main>
        <section
          className={heroStyles.heroFeature}
          data-cw-topbar-tone="dark"
          data-cw-semantic-role="route-index"
          data-cw-semantic-family="guide-method"
          data-cw-token-source="global-app-ds"
          style={heroStyle}
        >
          <div className={heroStyles.heroPhotoLayer}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={heroStyles.expertImage} src={platformAggregateArtwork.programs.desktop} alt="Програми CenterWay" />
          </div>
          <div className={heroStyles.heroFeatureContent}>
            <p className={heroStyles.heroBadge}>
              <span>Маршрути · Ритм · Глибина</span>
            </p>
            <h1 className={heroStyles.heroFeatureTitle}>Програми</h1>
            <p className={heroStyles.heroFeatureLead}>
              Короткі входи, довші програми і різна глибина роботи з тілом, ритмом, харчуванням та увагою.
            </p>
            <div className={heroStyles.heroFeatureActions}>
              <Link className={heroStyles.heroPrimaryButton} href="#program-catalog">
                Перейти до програм
              </Link>
            </div>
          </div>
        </section>

        <section className={`${offerStyles.container} ${offerStyles.section} ${offerStyles.sectionFlow}`}>
          <article className={offerStyles.panel}>
            <p className={offerStyles.label}>Як обирати</p>
            <ul className={offerStyles.timeline}>
              <li>міні-курси — для короткого входу без довгого зобов&apos;язання;</li>
              <li>програми — для глибшої роботи з тілом, харчуванням, рухом і ритмом;</li>
              <li>продукти винесені в окремий агрегатор, бо це інший тип поверхні і рішення;</li>
              <li>якщо стан неясний, спочатку тест доши або консультація.</li>
            </ul>
          </article>
        </section>

        <section
          id="program-catalog"
          className={`${offerStyles.container} ${offerStyles.section} ${offerStyles.sectionFlow}`}
          data-cw-semantic-role="offer-index"
          data-cw-semantic-family="guide-offer"
          data-cw-token-source="global-app-ds"
        >
          <div className={offerStyles.sectionHeader}>
            <div>
              <p className={offerStyles.label}>Усі програми</p>
              <h2 className={offerStyles.sectionTitle}>Оберіть глибину і ритм практики</h2>
            </div>
          </div>
          {/* The same one continuous catalogue, now narrowable. The filter
              removes cards from this grid; it never re-orders it, never splits
              it into rails and never replaces it with a feed — see
              `PlatformCatalogBrowser` and the aggregate-catalogue contract. */}
          <PlatformCatalogBrowser entries={authored.map(storefrontEntry)} currency={catalogCurrency(authored)} />
        </section>
      </main>
    </PlatformShell>
  );
}

export function PlatformTestsHubPage() {
  const heroArtwork = platformPageArtwork.dosha;
  const heroStyle = heroFraming(heroArtwork);
  const consultHref = getPlatformRoute("consult") ?? "/consult";

  return (
    <PlatformShell headerMode="overlay">
      <main data-cw-platform-template="tests-hub">
        <section
          className={heroStyles.heroFeature}
          data-cw-topbar-tone="dark"
          data-cw-semantic-role="route-index"
          data-cw-semantic-family="guide-progress"
          data-cw-token-source="global-app-ds"
          style={heroStyle}
        >
          <div className={heroStyles.heroPhotoLayer}>
            <PlatformHeroPhoto
              artwork={heroArtwork}
              alt="Діагностика CenterWay: три доші — три матеріали"
              className={heroStyles.expertImage}
              eager
            />
          </div>
          <div className={heroStyles.heroFeatureContent}>
            <p className={heroStyles.heroBadge}>
              <span>{testsHubCopy.badge}</span>
            </p>
            <h1 className={heroStyles.heroFeatureTitle}>{testsHubCopy.title}</h1>
            <p className={heroStyles.heroFeatureLead}>{testsHubCopy.lead}</p>
            <div className={heroStyles.heroFeatureActions}>
              <Link className={heroStyles.heroPrimaryButton} href="#tests-available">
                Перейти до тестів
              </Link>
            </div>
          </div>
        </section>

        <section className={`${offerStyles.container} ${offerStyles.section} ${offerStyles.sectionFlow}`}>
          <article className={offerStyles.panel}>
            <p className={offerStyles.label}>{testsHubCopy.readingLabel}</p>
            <ul className={offerStyles.timeline}>
              {testsHubCopy.readingItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </section>

        <section
          id="tests-available"
          className={`${offerStyles.container} ${offerStyles.section} ${offerStyles.sectionFlow}`}
          data-cw-semantic-role="offer-index"
          data-cw-semantic-family="guide-progress"
          data-cw-token-source="global-app-ds"
        >
          <div className={offerStyles.sectionHeader}>
            <div>
              <p className={offerStyles.label}>{testsHubCopy.activeLabel}</p>
              <h2 className={offerStyles.sectionTitle}>{testsHubCopy.activeTitle}</h2>
            </div>
          </div>
          <div className={offerStyles.aggregateRail} data-layout="single">
            {activePlatformTests.map((test) => (
              <PlatformOfferCard
                key={test.slug}
                title={test.title}
                tag={test.tag}
                meta={test.format}
                description={test.description}
                href={test.href}
                visual={test.visual}
                slug={test.slug}
                artwork={test.artwork}
                ctaLabel="Пройти тест"
              />
            ))}
          </div>
        </section>

        <section
          id="tests-planned"
          className={`${offerStyles.container} ${offerStyles.section} ${offerStyles.sectionFlow}`}
          data-cw-semantic-role="offer-index"
          data-cw-semantic-family="guide-progress"
          data-cw-token-source="global-app-ds"
        >
          <div className={offerStyles.sectionHeader}>
            <div>
              <p className={offerStyles.label}>{testsHubCopy.plannedLabel}</p>
              <h2 className={offerStyles.sectionTitle}>{testsHubCopy.plannedTitle}</h2>
            </div>
          </div>
          <div className={offerStyles.aggregateRail}>
            {plannedPlatformTests.map((test) => (
              <PlatformOfferCard
                key={test.slug}
                title={test.title}
                tag={test.tag}
                meta={test.format}
                description={test.description}
                href={test.href}
                visual={test.visual}
                slug={test.slug}
                status="planned"
                statusLabel={testsHubCopy.soonLabel}
              />
            ))}
          </div>
          <p className={offerStyles.proofNote}>{testsHubCopy.plannedNote}</p>
        </section>

        <section
          id="tests-consult"
          className={`${offerStyles.container} ${offerStyles.section} ${offerStyles.sectionFlow}`}
          data-cw-semantic-role="route-bridge"
          data-cw-semantic-family="guide-support"
          data-cw-token-source="global-app-ds"
        >
          <div className={offerStyles.sectionHeader}>
            <div>
              <p className={offerStyles.label}>{testsHubCopy.bridgeLabel}</p>
              <h2 className={offerStyles.sectionTitle}>{testsHubCopy.bridgeTitle}</h2>
            </div>
          </div>
          <article className={offerStyles.panel}>
            <div className={offerStyles.panelStack}>
              <p className={offerStyles.lead}>{testsHubCopy.bridgeLead}</p>
              <div>
                <Link className={offerStyles.primaryButton} href={consultHref}>
                  {testsHubCopy.bridgeCta}
                </Link>
              </div>
            </div>
          </article>
        </section>
      </main>
    </PlatformShell>
  );
}

/**
 * The three offers a herb buyer is most likely to be in the middle of.
 *
 * Named by COURSE slug — the row name, not the address — because that is what
 * an editorial list of "these three" is picking out. Where each one is
 * addressed is `course.href`'s business. This used to look in both shelves,
 * back when half the catalogue was hand-written; there is only one shelf now.
 */
const PRODUCT_RELATED_SLUGS = ["reset-day", "way21", "natural-body"];

export async function PlatformProductsIndexPage() {
  const featuredProduct = platformProductOffers[0];
  const authoredBySlug = new Map((await listStorefrontCourses()).map((course) => [course.slug, course]));
  const relatedPrograms = PRODUCT_RELATED_SLUGS.map((slug) => authoredBySlug.get(slug)).filter(
    (program) => program !== undefined,
  );
  const heroStyle = heroFraming(platformAggregateArtwork.products);

  if (!featuredProduct) {
    return (
      <PlatformShell headerMode="overlay">
        <main>
          <section className={`${offerStyles.container} ${offerStyles.section}`}>
            <article className={offerStyles.panel}>
              <p className={offerStyles.label}>Каталог</p>
              <h1 className={offerStyles.title}>Продукти CenterWay</h1>
              <p className={offerStyles.lead}>
                Цей каталог збирається навколо придатності й контексту. Якщо потрібен наступний крок вже зараз,
                почніть з доша-тесту або консультації.
              </p>
            </article>
          </section>
        </main>
      </PlatformShell>
    );
  }

  return (
    <PlatformShell headerMode="overlay">
      <main>
        <section
          className={heroStyles.heroFeature}
          data-cw-topbar-tone="dark"
          data-cw-semantic-role="route-index"
          data-cw-semantic-family="guide-trust"
          data-cw-token-source="global-app-ds"
          style={heroStyle}
        >
          <div className={heroStyles.heroPhotoLayer}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={heroStyles.expertImage} src={platformAggregateArtwork.products.desktop} alt="Продукти CenterWay" />
          </div>
          <div className={heroStyles.heroFeatureContent}>
            <p className={heroStyles.heroBadge}>
              <span>Підтримка · Придатність · Контекст</span>
            </p>
            <h1 className={heroStyles.heroFeatureTitle}>Продукти</h1>
            <p className={heroStyles.heroFeatureLead}>
              Окремий шар підтримки: трави й інші продуктові формати, які мають сенс тільки в контексті стану, режиму
              та того, що ви вже проходите.
            </p>
            <div className={heroStyles.heroFeatureActions}>
              <Link className={heroStyles.heroPrimaryButton} href="#product-focus">
                Дивитися трави
              </Link>
            </div>
          </div>
        </section>

        <section
          id="product-focus"
          className={`${offerStyles.container} ${offerStyles.section} ${offerStyles.sectionFlow}`}
          data-cw-semantic-role="offer-index"
          data-cw-semantic-family="guide-offer"
          data-cw-token-source="global-app-ds"
        >
          <div className={offerStyles.sectionHeader}>
            <div>
              <p className={offerStyles.label}>Поточний фокус</p>
              <h2 className={offerStyles.sectionTitle}>Трав&apos;яна підтримка як окремий продуктовий напрям</h2>
            </div>
          </div>
          {/* The "Як читати" panel that stood here is gone, and its three lines
              with it. They described ONE product from outside it, so a second
              product would have arrived under an argument about the first —
              exactly the shape a marketplace cannot use. Each card carries its
              own appropriateness/limits/context now (`points`), which also means
              they travel to the home block and the detail page unchanged. */}
          {/* The product rail is the same narrowable catalogue as /programs.
              With one product on the shelf the browser draws no control at all
              — one card cannot be narrowed to fewer than one — so this renders
              exactly as it did, and gains search and a price interval on the
              day a second product lands rather than needing a second pass. */}
          <PlatformCatalogBrowser
            entries={platformProductOffers.map((product) => ({
              key: product.slug,
              filter: {
                title: product.title,
                description: product.description,
                keywords: [product.tag, product.duration],
                // A herb jar is sold on its own funnel and has no offer row
                // here: «ціна за запитом», which is not zero. See catalogQuery.
                amount: null,
              },
              card: {
                title: product.title,
                tag: offerEyebrow(product.tag, product.duration),
                description: product.description,
                href: product.href,
                visual: product.visual,
                slug: product.slug,
                artwork: product.artwork,
              },
            }))}
          />
        </section>

        <section
          id="related-programs"
          className={`${offerStyles.container} ${offerStyles.section} ${offerStyles.sectionFlow}`}
          data-cw-semantic-role="route-bridge"
          data-cw-semantic-family="guide-support"
          data-cw-token-source="global-app-ds"
        >
          <div className={offerStyles.sectionHeader}>
            <div>
              <p className={offerStyles.label}>Пов&apos;язані програми</p>
              <h2 className={offerStyles.sectionTitle}>Де продукт має найбільше сенсу</h2>
            </div>
          </div>
          <PlatformOfferCarousel label="Пов’язані програми CenterWay" viewAllHref="/programs" viewAllLabel="Усі курси">
            {relatedPrograms.map((program) => (
              <PlatformOfferCard
                key={program.slug}
                title={program.title}
                tag={program.tag}
                description={program.description}
                href={program.href}
                visual={program.visual}
                ctaLabel="Деталі програми"
                slug={program.slug}
                artwork={program.artwork}
                commercialMode={program.commercialMode}
                price={program.price}
                compareAtPrice={program.compareAtPrice}
              />
            ))}
          </PlatformOfferCarousel>
        </section>
      </main>
    </PlatformShell>
  );
}
