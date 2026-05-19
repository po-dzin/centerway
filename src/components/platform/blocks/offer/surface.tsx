import Link from "next/link";
import { LeadForm } from "@/components/platform/LeadForm";
import styles from "@/components/platform/PlatformContentStyles";
import { currentProgram, routeLabels } from "@/components/platform/blocks/route/context";
import type { PlatformGeneratedBlockProps } from "@/components/platform/blocks/types";

function offerView(programSlug?: PlatformGeneratedBlockProps["programSlug"]) {
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

export function OfferHero({ programSlug }: Pick<PlatformGeneratedBlockProps, "programSlug">) {
  const { isMiniCourse, program, heroPrimaryCta, heroSecondaryCta } = offerView(programSlug);
  if (!program) return null;
  return (
    <section className={`${styles.container} ${styles.hero} ${styles.offerHeroLayout}`}>
      <aside className={styles.offerHeroVisualCard} data-visual={program.visual} aria-label={program.title}>
        <div className={styles.programPhoto} aria-hidden="true" />
        <div className={styles.offerHeroVisualMeta}>
          <p className={styles.label}>{program.duration}</p>
          <h3>{program.title}</h3>
          <p>{program.description}</p>
        </div>
      </aside>
      <div className={styles.heroPanel}>
        <div>
          <p className={styles.eyebrow}>{program.tag}</p>
          <h1 className={styles.heroTitle}>{program.fullTitle}</h1>
        </div>
        <p className={styles.lead}>{program.longDescription}</p>
        <div className={styles.heroFooter}>
          <Link className={styles.primaryButton} href={isMiniCourse ? "#program-results" : "#program-enroll"}>
            {heroPrimaryCta}
          </Link>
          {heroSecondaryCta ? (
            <Link className={styles.secondaryButton} href="#program-results">
              {heroSecondaryCta}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function OfferInfo({ programSlug }: Pick<PlatformGeneratedBlockProps, "programSlug">) {
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

export function OfferForm({ route, programSlug }: Pick<PlatformGeneratedBlockProps, "route" | "programSlug">) {
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
