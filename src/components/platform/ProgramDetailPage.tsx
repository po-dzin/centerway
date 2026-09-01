import {
  PlatformOfferMetaList,
  PlatformOfferSurfaceTemplate,
} from "@/components/platform/PlatformOfferSurfaceTemplate";
import { OfferCheckoutPanel, OfferFreePanel, OfferSupportPanel } from "@/components/platform/OfferCommerce";
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
import { resolveOfferCommerce, type OfferCommerce } from "@/lib/platform/offerCommerce";
import type { PlatformOfferSurfaceType } from "@/lib/platform/content";
import type { Author, Course } from "@/lms-core";
import type { ReactNode } from "react";

import { JsonLd } from "@/lib/seo/StructuredData";
import { breadcrumbLd, courseLd, graph } from "@/lib/seo/jsonLd";

/**
 * What this page actually needs, declared instead of inferred.
 *
 * It used to be typed as `(typeof programs)[number]` — one of the six literals
 * in content.ts — which made "an offer page" and "an offer hard-coded in
 * TypeScript" the same thing. A course out of the builder is an offer too, and
 * it satisfies exactly these ten fields. The six still pass unchanged: this is
 * a narrowing of what is asked for, not a change to what they carry.
 */
export type OfferSurface = {
  slug: string;
  title: string;
  fullTitle: string;
  /**
   * The line between the name and the tagline: what kind of thing this is.
   *
   * Optional, and empty for most offers. It exists because a title written in
   * the builder often carries two jobs in one string — «Розвантажувальний день
   * — практикум з умовного голодування» — and the half after the dash is not
   * noise, it just cannot be part of a name. The name is the h1, this is under
   * it, the tagline is under that. See `offerSubtitle`.
   */
  subtitle?: string;
  tag: string;
  duration: string;
  description: string;
  longDescription: string;
  results: readonly string[];
  surfaceType: PlatformOfferSurfaceType;
  artwork?: { desktop: string; desktopPosition?: string; mobilePosition?: string };
  /**
   * The offer surface proper (2026-08-26). Optional to a fault, and that is the
   * point: these are the things the six hand-written pages said in prose only a
   * developer could edit, and a course out of the builder says exactly as many
   * of them as its author has filled in. A page prints what it has and stays
   * quiet about the rest — never a heading over an empty list.
   */
  audience?: readonly string[];
  format?: readonly string[];
  /** The access promise printed beside the price — "доступ назавжди". */
  accessNote?: string;
  /** Why this author for this course. One sentence; the profile is joined separately. */
  authorNote?: string;
};

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
}: {
  program: OfferSurface;
  /**
   * The course this offer delivers, when the caller already has it.
   *
   * The six hand-written pages do not pass one and must not: they are
   * statically prerendered, and the snapshot read below is what keeps them
   * static. A page built from the database has already paid for the read.
   */
  course?: Course | null;
  /**
   * How this offer converts, when the caller already knows.
   *
   * The six hand-written pages do not pass one: their commerce is decided by
   * slug in `resolveOfferCommerce`, from constants, with no read. A course out
   * of the builder is priced in the database, and only the caller can await
   * that — so it hands the answer in rather than making this component async.
   */
  commerce?: OfferCommerce;
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
  const commerce = givenCommerce ?? resolveOfferCommerce(program.slug);
  const isCheckout = commerce.mode === "checkout";
  const isFree = commerce.mode === "free";
  // The SNAPSHOT on purpose: this page is statically prerendered and needs a
  // lesson count for a marketing claim, not live content. A live read here
  // would turn a static page into a per-request query.
  const course = given ?? getSnapshotCourseByProgram(program.slug);
  const lessonCount = course
    ? course.modules.reduce((total, module) => total + module.lessons.length, 0)
    : 0;
  const isMiniCourse = program.surfaceType === "mini-course";

  /* Where the thing you bought actually appears. Not one sentence for all of
     them: reset-day and way21 open in the cabinet, reboot and irem still
     deliver through the Telegram bot their funnels were built around, and
     saying "у кабінеті" for those would be a promise the platform does not
     keep. The course catalogue is the discriminator, because it is the thing
     that makes a cabinet delivery possible in the first place. */
  const deliveryLine = course
    ? isFree
      ? "курс відкриється у вашому кабінеті одразу після старту"
      : "курс відкриється у вашому кабінеті одразу після оплати"
    : "доступ приходить одразу після оплати — на сторінці підтвердження буде вхід у Telegram-бот";

  const includes = [
    course
      ? `${lessonCount} ${plural(lessonCount, "урок", "уроки", "уроків")} у ${course.modules.length} ${plural(course.modules.length, "модулі", "модулях", "модулях")}`
      : `${program.duration} за структурою автора`,
    deliveryLine,
    isFree ? "без оплати, підписки й автоплатежів" : "разова оплата, без підписки і автоплатежів",
    "проходити можна з телефона і з компʼютера",
  ];

  /* Duration is deliberately NOT in here any more. It is the panel's own title
     and, since the facts moved up, a hero pill as well — printing it a third
     time inside the panel it titles read as a stutter. */
  const formatMeta = [
    course ? `${lessonCount} ${plural(lessonCount, "урок", "уроки", "уроків")}` : program.tag,
    ...(program.accessNote ? [program.accessNote] : []),
    isCheckout ? "оплата просто тут, без переходу на лендинг" : isFree ? "доступ без оплати" : "участь узгоджуємо в розмові",
  ];

  /* THE FACTS, MOVED INTO THE HERO. These three used to be reachable only by
     scrolling to the «Формат» panel, which meant the questions a reader stops
     to look for — how long, how much of it, for how long is it mine — were
     answered below the thing they were deciding about.

     Filtered rather than padded: a course whose author has not written an
     access promise shows two pills, not three and a blank. */
  const heroMeta = [
    { label: program.duration, icon: "clock" as const },
    ...(course
      ? [{ label: `${lessonCount} ${plural(lessonCount, "урок", "уроки", "уроків")}`, icon: "day" as const }]
      : []),
    ...(program.accessNote ? [{ label: program.accessNote, icon: "shield-check" as const }] : []),
  ];

  const buyHref = isCheckout ? commerce.checkoutHref : isFree ? commerce.accessHref : "#program-enroll";
  const buyLabel = isCheckout ? "Придбати доступ" : isFree ? "Почати безкоштовно" : "Записатися на програму";

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
          ...(program.subtitle ? { subtitle: program.subtitle } : {}),
          description: program.description,
          badge: `${program.tag} · ${program.duration}`,
          artwork: program.artwork,
          imageAlt: program.title,
          templateKind: "program",
          /* The author's own way in, on the hero's utility line. Renders for
             nobody else, including the buyer looking at the same page. */
          ...(course ? { utility: <CourseAuthorLink courseSlug={course.slug} tone="media" /> } : {}),
          meta: heroMeta,
          commitment: (
            <OfferHeroCommitment
              commerce={{
                price: isCheckout || isFree ? commerce.price : null,
                compareAtPrice: isCheckout ? commerce.compareAtPrice : null,
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
                ])
              )}
            />
            {/* `OwnedCourseNotice` used to sit here — a banner telling a buyer
                they already owned the course, under a hero still selling it to
                them. The hero says it now, in the place the contradiction was,
                and a second announcement below would be the platform saying the
                same thing twice in two voices. */}
            <OfferBento audience={program.audience} results={program.results} format={program.format} />
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
          label: "Формат",
          title: program.duration,
          body: <PlatformOfferMetaList items={formatMeta} />,
        }}
        beforeSupport={
          <>
            {course ? <OfferCurriculum course={course} /> : null}
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
                      ? `Оплата проходить тут, на платформі, без переходу на окремий лендинг: ${deliveryLine}.`
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
            }
          />
        }
        trailing={
          <OfferStickyBar
            price={isCheckout || isFree ? commerce.price : null}
            buyHref={buyHref}
            buyLabel={buyLabel}
          />
        }
        boundary={{
          label: "Межі методу",
          title: "Чесний формат без медичних обіцянок",
          lead:
            "CenterWay працює як освітня wellness-платформа і супровід практики. Програми не замінюють діагностику, лікування або рекомендації вашого лікаря; якщо є гострі стани, вагітність, хронічні захворювання або медикаментозна терапія, спочатку потрібна медична консультація.",
        }}
        afterBoundary={nextStep}
      />
    </OfferAccessProvider>
  );
}

function plural(count: number, one: string, few: string, many: string): string {
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  const mod10 = count % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}
