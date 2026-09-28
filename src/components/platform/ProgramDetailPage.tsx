import { plural } from "@/lib/plural";
import type { OfferSurface } from "@/lib/platform/offerSurface";
import {
  PlatformOfferMetaList,
  PlatformOfferSurfaceTemplate,
} from "@/components/platform/PlatformOfferSurfaceTemplate";
import { OfferCheckoutPanel, OfferFreePanel, OfferSupportPanel } from "@/components/platform/OfferCommerce";
import { OfferFormats } from "@/components/platform/OfferFormats";
import type { ProgramFormat } from "@/lib/experiences/formats";
import { formatPrice } from "@/lib/products";
import { OfferCurriculum } from "@/components/platform/OfferCurriculum";
import { OfferAccessProvider } from "@/components/platform/OfferAccess";
import { OfferHeroActions, OfferHeroCommitment } from "@/components/platform/OfferHeroState";
import { OfferAuthor, OfferBento } from "@/components/platform/OfferFacets";
import { OfferStickyBar } from "@/components/platform/OfferStickyBar";
import { OfferSupport } from "@/components/platform/OfferSupportState";
import offerPanelStyles from "@/components/platform/PlatformOfferStyles";
import { LeadForm } from "@/components/platform/LeadForm";
import { CourseAuthorLink } from "@/components/platform/AuthorEntry";
import { getSnapshotCourseByProgram } from "@/lib/lms/catalog";
import { offerLandingUrl } from "@/lib/platform/offerLanding";
import type { OfferCommerce } from "@/lib/platform/offerCommerce";
import { isLinkedModule, type Author, type Course } from "@/lms-core";
import type { ReactNode } from "react";

import { JsonLd } from "@/components/seo/StructuredData";
import { breadcrumbLd, courseLd, graph } from "@/lib/seo/jsonLd";

export type { OfferSurface } from "@/lib/platform/offerSurface";

/**
 * A platform offer page.
 *
 * Two things changed here, and they are the same change seen twice.
 *
 * IT SELLS. Every offer page used to end in the same lead form — including the
 * four offers whose funnels have taken card payments for months. Someone who
 * reached this page could not buy what it was selling; they could only ask to
 * be told how. Now an offer with a payable product code carries a price and a
 * checkout, and only an offer that is genuinely agreed in conversation keeps a
 * form (`resolveOfferCommerce`).
 *
 * IT SAYS WHAT IS INSIDE. The "format" panel used to print two sentences that
 * were true of every offer in the catalogue — "a short entry into the system
 * without a long commitment" — because they were written once for all of them.
 * The real answer already existed in `data/courses/**`, which is what serves
 * the lessons, so the outline is read from there and cannot drift from what a
 * buyer actually receives.
 */
export function ProgramDetailPage({
  program,
  course: given,
  commerce: givenCommerce,
  author = null,
  purchase,
  nextStep,
  formats = [],
}: {
  program: OfferSurface;
  /**
   * The ways through this program (2026-09-25), when there is more than one.
   * With two or more, the page sells the CHOICE: the hero leads to the formats
   * and quotes the lowest price, and the enrol section is the formats side by
   * side. With one or none, everything below is the single offer it always was.
   */
  formats?: ProgramFormat[];
  /**
   * The course this offer delivers, when the caller already has it.
   *
   * The six hand-written pages do not pass one and must not: they are
   * statically prerendered, and the snapshot read below is what keeps them
   * static. A page built from the database has already paid for the read.
   */
  course?: Course | null;
  /**
   * How this offer converts. Priced in the database, and only the caller can
   * await that — so it hands the answer in rather than making this component
   * async.
   */
  commerce: OfferCommerce;
  /**
   * The byline, when the caller has read it.
   *
   * Not looked up here for the same reason `commerce` is not: this component is
   * synchronous so the six hand-written pages stay statically prerendered, and
   * a profile lives in a table only an async caller can reach.
   */
  author?: Author | null;
  /**
   * The confirmation, when the reader has just come back from paying.
   *
   * A slot rather than a flag: only the route can read the return parameters,
   * and only it can resolve the offer they name.
   */
  purchase?: ReactNode;
  nextStep?: ReactNode;
}) {
  const commerce = givenCommerce;
  const isCheckout = commerce.mode === "checkout";
  const isFree = commerce.mode === "free";
  // The SNAPSHOT on purpose: this page is statically prerendered and needs a
  // lesson count for a marketing claim, not live content. A live read here
  // would turn a static page into a per-request query.
  const course = given ?? getSnapshotCourseByProgram(program.slug);
  const lessonCount = course ? course.modules.reduce((total, module) => total + module.lessons.length, 0) : 0;
  const isMiniCourse = program.surfaceType === "mini-course";

  /* Where the thing you bought actually appears. Everything is delivered on the
     platform now: since 2026-08-29 no bot issues a course, and the bots are
     support and conversation only. A course opens in the library; a product
     with no course behind it (the herbal blend) appears in the cabinet. */
  const deliveryLine = course
    ? isFree
      ? "Курс відкриється у вашому кабінеті одразу після старту"
      : "Курс відкриється у вашому кабінеті одразу після оплати"
    : "Одразу після оплати замовлення зʼявиться у вашому кабінеті на платформі";

  /* SENTENCE CASE THROUGHOUT (2026-09-11). These lines are list items, and
     every other list on the page — what the reader gets, who it is for, what it
     is made of — is written by the author in sentence case. Lowercase here made
     the platform's own lines read as a footnote beside them. */
  const includes = [
    course
      ? `${lessonCount} ${plural(lessonCount, "урок", "уроки", "уроків")} у ${course.modules.length} ${plural(course.modules.length, "модулі", "модулях", "модулях")}`
      : `${program.duration} за структурою автора`,
    deliveryLine,
    isFree ? "Без оплати, підписки й автоплатежів" : "Разова оплата, без підписки і автоплатежів",
    "Проходити можна з телефона і з компʼютера",
  ];

  /* ONE FACT, ONE PLACE (2026-09-08).
     Neither the duration nor the access promise is in here. Every fact this
     page states now has exactly one home, and repetition is reserved for the
     price, which is quoted again beside its own button because that is where
     it is acted on:

       рід · тривалість   → the hero's badge
       ціна · доступ      → the commitment under it
       кількість уроків   → this list
       ритм               → this panel's title
       що входить в оплату → the checkout panel

     Before this the hero printed a pill row that repeated all three facts of
     the panel below it, so «7 днів» appeared in the badge and again as a pill,
     and «доступ назавжди» sat twice within one screen — once as a pill and
     once under the price. */
  /* The protocol's own lessons: the reference entries are named separately in
     the same list, and the hero's progress already counts only these. */
  const stepCount = course ? lessonCount - referenceLessons(course) : lessonCount;
  const lessonLabel = `${stepCount} ${plural(stepCount, "урок", "уроки", "уроків")}`;
  const formatMeta = [
    /* AND THE COUNT IS SKIPPED WHEN THE BADGE IS ALREADY PRINTING IT. With no
       `durationDays` set, `program.duration` IS the lesson count — see
       courseOffer.ts — so the badge above reads «ЧЕК-ЛИСТ · 6 УРОКІВ» and this
       line would repeat it word for word. Comparing the strings rather than
       re-deriving the condition keeps this true even if that fallback changes. */
    ...(course && lessonLabel !== program.duration ? [lessonLabel] : []),
    ...(course ? [] : [program.tag]),
    /* HOW IT IS WALKED, NOT HOW IT IS PAID FOR (2026-09-25). This line used
       to be «Оплата просто тут, без переходу на лендинг» — a remark about the
       checkout, printed in the panel about the course's shape, a screen above
       the checkout that says it again. The panel now answers its own question:
       how the lessons arrive, what else sits beside them, where it is read. */
    ...(course ? [rhythmLine(course)] : []),
    ...(course && referenceLessons(course) > 0
      ? [
          `Окремо від уроків — ${referenceLessons(course)} ${plural(referenceLessons(course), "довідковий матеріал", "довідкові матеріали", "довідкових матеріалів")}`,
        ]
      : []),
    "Проходити можна з телефона і з компʼютера",
  ];

  /* WHAT THE PANEL IS TITLED, now that the duration is the badge's.
     A course is either walked a day at a time or read at the reader's own
     speed, and that is the one thing about its shape the page never said —
     `schedule.mode` has been in the data since the LMS shipped and only the
     lesson player ever read it. With no course to ask (a page whose offer is
     not delivered here), the duration is still the honest title. */
  const rhythmTitle = course
    ? course.schedule.mode === "daily"
      ? "День за днем"
      : "У своєму темпі"
    : program.duration;
  /* «Формат» was also the name of the formats block further down — two panels
     a screen apart under one word, one about the course's shape and one about
     ways to buy it. This one is the shape. */

  /* THE PILL ROW IS GONE (2026-09-08), and the note it replaces is worth
     keeping as the reason it existed: the three facts used to be reachable only
     by scrolling past the thing a reader was deciding about, so they were
     lifted into the hero. They were never removed from where they came from,
     which is how the page ended up saying «7 днів» in the badge and again a
     line below it, and the access promise twice within one screen.

     The facts stayed lifted; the duplicates went. See `formatMeta` above for
     where each one now lives — including the guard this row was carrying,
     which moved there with the count it protects. */

  const choosesFormat = formats.length >= 2;
  const lowestFormat = formats
    .filter((format) => format.mode === "checkout" && format.amount !== null)
    .sort((a, b) => (a.amount ?? 0) - (b.amount ?? 0))[0];
  const formatFromPrice =
    choosesFormat && lowestFormat?.amount != null
      ? `від ${formatPrice(lowestFormat.amount, lowestFormat.currency)}`
      : null;

  const buyHref = choosesFormat
    ? "#formats"
    : isCheckout
      ? commerce.checkoutHref
      : isFree
        ? commerce.accessHref
        : "#program-enroll";
  const buyLabel = choosesFormat
    ? "Обрати формат"
    : isCheckout
      ? "Купити"
      : isFree
        ? "Почати безкоштовно"
        : "Записатися на програму";
  const heroPrice = choosesFormat ? formatFromPrice : isCheckout || isFree ? commerce.price : null;

  return (
    /* EVERYTHING INSIDE ONE PROVIDER, and only two things read it. The hero and
       the outline are the parts of an offer page that stop being an offer once
       you own it; the rest — what it is, who it is for, who wrote it — is the
       same page either way, and wrapping it costs nothing because a server
       component passed through a client provider stays server-rendered. */
    <OfferAccessProvider programSlug={program.slug}>
      <PlatformOfferSurfaceTemplate
        templateKind="program"
        trail={[{ label: "Програми", href: "/programs" }, { label: program.title }]}
        hero={{
          title: program.fullTitle,
          /* The author's line above the name, when they wrote one. It reaches
             the catalogue card already; this is the page that card previews. */
          ...(program.pretitle ? { pretitle: program.pretitle } : {}),
          /* The hero prints the author's whole title. Its legacy subtitle is
             parsed from the same string, so it is suppressed when that title
             already ends in it rather than repeating the phrase. */
          ...(program.subtitle && !program.fullTitle.includes(program.subtitle) ? { subtitle: program.subtitle } : {}),
          description: program.description,
          badge: `${program.tag} · ${program.duration}`,
          artwork: program.artwork,
          imageAlt: program.title,
          templateKind: "program",
          /* The author's own way in, on the hero's utility line. Renders for
             nobody else, including the buyer looking at the same page. */
          ...(course ? { utility: <CourseAuthorLink courseSlug={course.slug} tone="media" /> } : {}),
          commitment: (
            <OfferHeroCommitment
              commerce={{
                price: heroPrice,
                // The free branch quotes a former price too, when the owner has
                // set one: «було 795 ₴ — зараз безкоштовно» is the whole
                // sentence, and the hero is where it is read.
                compareAtPrice: !choosesFormat && (isCheckout || isFree) ? commerce.compareAtPrice : null,
                accessNote: program.accessNote ?? null,
              }}
            />
          ),
          actions: (
            <OfferHeroActions
              buyHref={buyHref}
              buyLabel={buyLabel}
              secondaryLabel={course ? "Що всередині" : "Подивитися деталі"}
            />
          ),
          /* Still required by the hero's own contract, and still the right
             answer for a surface that passes no `actions` slot. This page always
             does, so these are the fallback nobody reaches — kept because the
             hero is shared with the product and consult templates. */
          primaryAction: { href: buyHref, label: buyLabel },
          secondaryAction: {
            href: course ? "#program-plan" : "#program-results",
            label: course ? "Що всередині" : "Подивитися деталі",
          },
        }}
        afterHero={
          <>
            {/* FIRST, above everything the page says about itself. Somebody who
                has just paid is looking for one answer, and it must not be
                below a sales pitch. */}
            {purchase}
            {/* The offer, stated for machines, from the same three facts the page
                prints: what it is, how long it takes, what it costs. The figure is
                `commerce.amount` — the quotable one — so a page can never publish a
                price different from the one in its checkout offer. */}
            <JsonLd
              data={graph(
                courseLd({
                  path: `/programs/${program.slug}`,
                  name: program.fullTitle,
                  description: program.longDescription || program.description,
                  price: isCheckout || isFree ? commerce.amount : null,
                  currency: isCheckout || isFree ? commerce.currency : undefined,
                  duration: program.duration,
                  ...(program.artwork ? { image: program.artwork.desktop } : {}),
                }),
                breadcrumbLd([
                  { path: "/", name: "CenterWay" },
                  { path: "/programs", name: "Програми" },
                  { path: `/programs/${program.slug}`, name: program.title },
                ]),
              )}
            />
            {/* `OwnedCourseNotice` used to sit here — a banner telling a buyer
                they already owned the course, under a hero still selling it to
                them. The hero says it now, in the place the contradiction was,
                and a second announcement below would be the platform saying the
                same thing twice in two voices. */}
          </>
        }
        detailSectionId="program-results"
        detailSemanticFamily="method-progress"
        /* THE SPLIT STOPPED REPEATING THE BENTO. Its left panel used to print
           `program.results` as a list, and the bento above now prints the same
           list under the same heading — two identical bullet sets a screen
           apart, which reads as a page that lost its place.

           So the split takes the half the bento cannot: the paragraph. The
           bento is what a reader SCANS, this is what they read once they have
           decided to. */
        detailLeft={{
          label: "Про метод",
          title: isMiniCourse ? "Що дає цей короткий вхід" : "Коротко про результат",
          lead: program.longDescription,
        }}
        detailRight={{
          label: "Як побудовано",
          title: rhythmTitle,
          body: <PlatformOfferMetaList items={formatMeta} />,
        }}
        beforeSupport={
          <>
            {/* THE PROSE COMES FIRST, THE CARDS ANSWER IT (2026-09-08).
                The three cards used to sit directly under the hero, above the
                split — so the page opened with three columns of bullet lists
                and only then said what the method is. That is an index before
                the thing it indexes: a reader who has just read a one-line
                tagline is asked to scan «для кого / що зміниться / що входить»
                without yet knowing what the work IS.

                The order is now: what this method is and what shape it takes
                (the split, «Про метод» + «Формат»), then the three answers to
                the questions that follow from it, then the outline of the
                actual lessons. Each block narrows the one above it instead of
                repeating it — and «Формат» is said once, by the panel that
                means the commitment (see `OfferBento`'s own note on the
                rename). */}
            <OfferBento audience={program.audience} results={program.results} format={program.format} />
            {course ? (
              <OfferCurriculum course={course} landingHref={offerLandingUrl(program.slug)} formats={formats} />
            ) : null}
            <OfferAuthor author={author} note={program.authorNote} />
          </>
        }
        supportSectionId="program-enroll"
        /* Required by the template and unreachable here: the slot below always
           wins. Kept because the type is shared with the product and consult
           pages, which have no access state to swap on. */
        supportLeft={{ label: "Участь", title: program.title }}
        supportSlot={
          <OfferSupport
            title={program.title}
            sales={
              choosesFormat ? (
                <OfferFormats programSlug={program.slug} programTitle={program.title} formats={formats} />
              ) : (
                <>
                  <article className={offerPanelStyles.panel}>
                    <p className={offerPanelStyles.label}>{isCheckout ? "Участь" : isFree ? "Доступ" : "Запис"}</p>
                    <h2 className={offerPanelStyles.title}>
                      {isCheckout
                        ? `Відкрити доступ до «${program.title}»`
                        : isFree
                          ? `Почати «${program.title}» без оплати`
                          : `Записатися на «${program.title}»`}
                    </h2>
                    <p className={offerPanelStyles.lead}>
                      {isCheckout
                        ? `Разова оплата, без підписки. ${deliveryLine}.`
                        : isFree
                          ? `Це безкоштовний доступ до курсу: ${deliveryLine}. Увійдіть або створіть акаунт, щоб зберегти прогрес.`
                          : "Цю програму ми узгоджуємо в розмові — щоб формат, темп і межі методу підходили саме вашому стану. Залиште контакт, і ми повернемося з деталями і способом оплати."}
                    </p>
                  </article>
                  {isCheckout ? (
                    <OfferCheckoutPanel
                      commerce={commerce}
                      label="Оплата"
                      title={program.title}
                      lead={program.description}
                      includes={includes}
                      ctaLabel={`Оплатити ${commerce.price}`}
                    />
                  ) : isFree ? (
                    <OfferFreePanel
                      commerce={commerce}
                      label="Безкоштовний доступ"
                      title="Почати навчання"
                      lead={program.description}
                      includes={includes}
                      ctaLabel="Відкрити курс"
                    />
                  ) : (
                    <OfferSupportPanel label="Форма" title="Залишити контакти">
                      <LeadForm
                        productCode={commerce.leadProductCode}
                        source={`platform_${program.slug}_form`}
                        ctaPlace={`${program.slug}_offer`}
                      />
                    </OfferSupportPanel>
                  )}
                </>
              )
            }
          />
        }
        trailing={<OfferStickyBar price={heroPrice} buyHref={buyHref} buyLabel={buyLabel} />}
        boundary={{
          label: "Межі методу",
          title: "Чесний формат без медичних обіцянок",
          lead: "CenterWay працює як освітня wellness-платформа і супровід практики. Програми не замінюють діагностику, лікування або рекомендації вашого лікаря; якщо є гострі стани, вагітність, хронічні захворювання або медикаментозна терапія, спочатку потрібна медична консультація.",
        }}
        afterBoundary={nextStep}
      />
    </OfferAccessProvider>
  );
}

/* How the lessons arrive, in the terms of the course's own schedule. */
function rhythmLine(course: Course): string {
  if (course.schedule.mode === "daily") {
    return course.schedule.gate === "hard"
      ? "Щодня відкривається урок свого дня — від дати старту"
      : "Кожен урок має свій день; наперед можна зазирнути будь-коли";
  }
  if (course.schedule.mode === "sequential") return "Уроки відкриваються по черзі, у вашому темпі";
  return "Усі уроки відкриті одразу — у вашому темпі";
}

/* Entries in reference modules (recipes, blends, recordings) — the material
   beside the protocol, not a step of it. Linked programs hold no lessons here
   and are bonuses of particular formats, said by the formats block. */
function referenceLessons(course: Course): number {
  return course.modules
    .filter((module) => module.reference && !isLinkedModule(module))
    .reduce((total, module) => total + module.lessons.length, 0);
}
