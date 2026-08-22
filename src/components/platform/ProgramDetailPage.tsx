import {
  PlatformOfferMetaList,
  PlatformOfferResultList,
  PlatformOfferSurfaceTemplate,
} from "@/components/platform/PlatformOfferSurfaceTemplate";
import {
  OfferCheckoutPanel,
  OfferCurriculum,
  OfferSupportPanel,
} from "@/components/platform/OfferCommerce";
import { LeadForm } from "@/components/platform/LeadForm";
import { OwnedCourseNotice } from "@/components/platform/OwnedCourseNotice";
import { CourseAuthorLink } from "@/components/platform/AuthorEntry";
import { getSnapshotCourseByProgram } from "@/lib/lms/catalog";
import { resolveOfferCommerce, type OfferCommerce } from "@/lib/platform/offerCommerce";
import type { PlatformOfferSurfaceType } from "@/lib/platform/content";
import type { Course } from "@/lms-core";

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
  tag: string;
  duration: string;
  description: string;
  longDescription: string;
  results: readonly string[];
  surfaceType: PlatformOfferSurfaceType;
  artwork?: { desktop: string; desktopPosition?: string; mobilePosition?: string };
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
}) {
  const commerce = givenCommerce ?? resolveOfferCommerce(program.slug);
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
    ? "курс відкриється у вашому кабінеті одразу після оплати"
    : "доступ приходить одразу після оплати — на сторінці підтвердження буде вхід у Telegram-бот";

  const includes = [
    course
      ? `${lessonCount} ${plural(lessonCount, "урок", "уроки", "уроків")} у ${course.modules.length} ${plural(course.modules.length, "модулі", "модулях", "модулях")}`
      : `${program.duration} за структурою автора`,
    deliveryLine,
    "разова оплата, без підписки і автоплатежів",
    "проходити можна з телефона і з компʼютера",
  ];

  const formatMeta = [
    program.duration,
    course ? `${lessonCount} ${plural(lessonCount, "урок", "уроки", "уроків")}` : program.tag,
    commerce.mode === "checkout" ? "оплата просто тут, без переходу на лендинг" : "участь узгоджуємо в розмові",
  ];

  return (
    <PlatformOfferSurfaceTemplate
      templateKind="program"
      trail={[{ label: "Програми", href: "/programs" }, { label: program.title }]}
      hero={{
        title: program.fullTitle,
        description: program.description,
        badge: `${program.tag} · ${program.duration}`,
        artwork: program.artwork,
        imageAlt: program.title,
        templateKind: "program",
        primaryAction: {
          href: "#program-enroll",
          /* The price in the label, when there is one: a CTA that names the
             figure is the difference between "another page" and an offer. */
          label:
            commerce.mode === "checkout" ? `Купити за ${commerce.price}` : "Записатися на програму",
        },
        secondaryAction: {
          href: course ? "#program-plan" : "#program-results",
          label: course ? "Що всередині" : "Подивитися деталі",
        },
      }}
      afterHero={
        <>
          <OwnedCourseNotice programSlug={program.slug} />
          {/* The author's own way in. Renders for nobody else, including the
              buyer looking at the same page. */}
          {course ? <CourseAuthorLink courseSlug={course.slug} /> : null}
        </>
      }
      detailSectionId="program-results"
      detailSemanticFamily="method-progress"
      detailLeft={{
        label: "Що змінюємо",
        title: isMiniCourse ? "Що дає цей короткий вхід" : "Коротко про результат",
        body: <PlatformOfferResultList items={program.results.slice(0, 5)} />,
      }}
      detailRight={{
        label: "Формат",
        title: program.duration,
        lead: program.longDescription,
        body: <PlatformOfferMetaList items={formatMeta} />,
      }}
      beforeSupport={course ? <OfferCurriculum course={course} /> : null}
      supportSectionId="program-enroll"
      supportLeft={{
        label: commerce.mode === "checkout" ? "Участь" : "Запис",
        title:
          commerce.mode === "checkout"
            ? `Відкрити доступ до «${program.title}»`
            : `Записатися на «${program.title}»`,
        lead:
          commerce.mode === "checkout"
            ? `Оплата проходить тут, на платформі, без переходу на окремий лендинг: ${deliveryLine}.`
            : "Цю програму ми узгоджуємо в розмові — щоб формат, темп і межі методу підходили саме вашому стану. Залиште контакт, і ми повернемося з деталями і способом оплати.",
      }}
      supportRight={
        commerce.mode === "checkout" ? (
          <OfferCheckoutPanel
            commerce={commerce}
            label="Оплата"
            title={program.title}
            lead={program.description}
            includes={includes}
            ctaLabel={`Оплатити ${commerce.price}`}
          />
        ) : (
          <OfferSupportPanel label="Форма" title="Залишити контакти">
            <LeadForm
              productCode={commerce.leadProductCode}
              source={`platform_${program.slug}_form`}
              ctaPlace={`${program.slug}_offer`}
            />
          </OfferSupportPanel>
        )
      }
      boundary={{
        label: "Межі методу",
        title: "Чесний формат без медичних обіцянок",
        lead:
          "CenterWay працює як освітня wellness-платформа і супровід практики. Програми не замінюють діагностику, лікування або рекомендації вашого лікаря; якщо є гострі стани, вагітність, хронічні захворювання або медикаментозна терапія, спочатку потрібна медична консультація.",
      }}
    />
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
