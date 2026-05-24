import {
  PlatformOfferMetaList,
  PlatformOfferResultList,
  PlatformOfferSurfaceTemplate,
} from "@/components/platform/PlatformOfferSurfaceTemplate";
import type { programs } from "@/lib/platform/content";

type Program = (typeof programs)[number];

export function ProgramDetailPage({ program }: { program: Program }) {
  const isMiniCourse = program.surfaceType === "mini-course";
  const supportTitle = isMiniCourse ? `Оформити ${program.title}` : `Записатися на ${program.title}`;
  const supportLead = isMiniCourse
    ? "Це короткий platform mini-course без переходу на окремий лендинг. Залиште контакт тут, щоб отримати підтвердження формату, спосіб оплати і найближчий крок прямо всередині платформи."
    : "Це платформена сторінка програми: залиште запит тут, якщо хочете отримати підтвердження формату, деталі оплати і наступний крок без переходу на окремий лендинг.";
  const formatMeta = isMiniCourse
    ? [
        "короткий вхід у систему без довгого зобов'язання",
        "рішення про участь, оплата і наступний крок живуть у межах цієї сторінки",
      ]
    : [
        "платформений маршрут без переходу на окремий лендинг",
        "підтвердження формату, оплата і наступний крок живуть у межах цієї сторінки",
      ];
  const productCode =
    program.slug === "ideal-body"
      ? "ideal-body"
      : program.slug === "irem"
        ? "irem"
        : isMiniCourse
          ? "platform"
          : "consult";

  return (
    <PlatformOfferSurfaceTemplate
      templateKind="program"
      hero={{
        title: program.fullTitle,
        description: program.description,
        badge: `${program.tag} · ${program.duration}`,
        artwork: program.artwork,
        imageAlt: program.title,
        templateKind: "program",
        primaryAction: {
          href: "#program-enroll",
          label: isMiniCourse ? "Перейти до формату" : "Записатися на програму",
        },
        secondaryAction: {
          href: "#program-results",
          label: isMiniCourse ? "Подивитися формат" : "Подивитися деталі",
        },
      }}
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
        lead: program.description,
        body: <PlatformOfferMetaList items={formatMeta} />,
      }}
      supportSectionId="program-enroll"
      supportLeft={{
        label: isMiniCourse ? "Участь" : "Запис",
        title: supportTitle,
        lead: supportLead,
      }}
      form={{
        label: "Форма",
        title: "Залишити контакти",
        productCode,
        source: `platform_${program.slug}_form`,
        ctaPlace: `${program.slug}_offer`,
      }}
      boundary={{
        label: "Межі методу",
        title: "Чесний формат без медичних обіцянок",
        lead:
          "CenterWay працює як освітня wellness-платформа і маршрут практики. Програми не замінюють діагностику, лікування або рекомендації вашого лікаря; якщо є гострі стани, вагітність, хронічні захворювання або медикаментозна терапія, спочатку потрібна медична консультація.",
      }}
    />
  );
}
