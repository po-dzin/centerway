import { LeadForm } from "@/components/platform/LeadForm";
import { PlatformDetailHero } from "@/components/platform/PlatformDetailHero";
import styles from "@/components/platform/PlatformContentStyles";
import { currentProgram, routeLabels } from "@/components/platform/blocks/route/context";
import type { PlatformRouteBlockProps } from "@/components/platform/blocks/types";

function offerView(programSlug?: PlatformRouteBlockProps["programSlug"]) {
  const program = currentProgram(programSlug);
  const isMiniCourse = program?.surfaceType === "mini-course";

  return {
    program,
    isMiniCourse,
    heroPrimaryCta: isMiniCourse ? "Перейти до формату" : "Записатися на програму",
    heroSecondaryCta: isMiniCourse ? null : "Подивитися деталі",
    detailsTitle: isMiniCourse ? "Що дає цей короткий вхід" : "Коротко про результат",
    supportLabel: isMiniCourse ? "Участь" : "Запис",
    supportTitle: isMiniCourse ? `Оформити ${program?.title ?? "участь"}` : `Записатися на ${program?.title ?? ""}`,
    supportLead: isMiniCourse
      ? "Це короткий platform mini-course без переходу на окремий лендинг. Залиште контакт тут, щоб отримати підтвердження формату, спосіб оплати і найближчий крок прямо всередині платформи."
      : "Це вже продаюча platform-сторінка: залиште запит тут, якщо хочете отримати підтвердження формату, деталі оплати і наступний крок без переходу на окремий лендинг.",
    formatMeta: isMiniCourse
      ? [
          "короткий вхід у систему без довгого зобов'язання",
          "рішення про участь, оплата і наступний крок живуть у межах цієї сторінки",
        ]
      : [
          "платформений маршрут без переходу на окремий лендинг",
          "підтвердження формату, оплата і наступний крок живуть у межах цієї сторінки",
        ],
    productCode:
      program?.slug === "ideal-body"
        ? "ideal-body"
        : program?.slug === "irem"
          ? "irem"
          : program?.surfaceType === "mini-course"
            ? "platform"
            : "consult",
  };
}

export function OfferHero({ programSlug }: Pick<PlatformRouteBlockProps, "programSlug">) {
  const { isMiniCourse, program, heroPrimaryCta, heroSecondaryCta } = offerView(programSlug);
  if (!program) return null;

  return (
    <PlatformDetailHero
      title={program.fullTitle}
      description={program.description}
      badge={`${program.tag} · ${program.duration}`}
      artwork={program.artwork}
      imageAlt={program.title}
      templateKind="program"
      primaryAction={{
        href: isMiniCourse ? "#program-enroll" : "#program-enroll",
        label: heroPrimaryCta,
      }}
      secondaryAction={heroSecondaryCta ? { href: "#program-results", label: heroSecondaryCta } : null}
    />
  );
}

export function OfferInfo({ programSlug }: Pick<PlatformRouteBlockProps, "programSlug">) {
  const { program, detailsTitle, formatMeta } = offerView(programSlug);
  if (!program) return null;
  return (
    <section className={`${styles.container} ${styles.section}`} id="program-results">
      <div className={`${styles.split} ${styles.programOfferDetailsGrid}`}>
        <article className={styles.panel}>
          <p className={styles.label}>Що змінюємо</p>
          <h2 className={styles.title}>{detailsTitle}</h2>
          <ul className={`${styles.timeline} ${styles.programResultList}`}>
            {program.results.slice(0, 5).map((result) => (
              <li key={result}>{result}</li>
            ))}
          </ul>
        </article>
        <article className={styles.panel}>
          <p className={styles.label}>Формат</p>
          <h2 className={styles.title}>{program.duration}</h2>
          <p className={styles.lead}>{program.description}</p>
          <div className={styles.programFormatMeta}>
            {formatMeta.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

export function OfferForm({ route, programSlug }: Pick<PlatformRouteBlockProps, "route" | "programSlug">) {
  const { productCode, supportLabel, supportLead, supportTitle } = offerView(programSlug);
  return (
    <section className={`${styles.container} ${styles.section}`} id="program-enroll">
      <div className={styles.split}>
        <article className={styles.panel}>
          <p className={styles.label}>{supportLabel}</p>
          <h2 className={styles.title}>{supportTitle || routeLabels[route]}</h2>
          <p className={styles.lead}>{supportLead}</p>
        </article>
        <article className={styles.formPanel}>
          <p className={styles.label}>Форма</p>
          <h2 className={styles.title}>Залишити контакти</h2>
          <LeadForm
            productCode={productCode}
            source={`platform_${route}_form`}
            ctaPlace={`${route}_offer`}
          />
        </article>
      </div>
    </section>
  );
}
