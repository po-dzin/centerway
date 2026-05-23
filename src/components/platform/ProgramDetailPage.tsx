import { LeadForm } from "@/components/platform/LeadForm";
import { PlatformDetailHero } from "@/components/platform/PlatformDetailHero";
import { PlatformShell } from "@/components/platform/PlatformLayout";
import styles from "@/components/platform/PlatformContentStyles";
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
    <PlatformShell headerMode="overlay">
      <main data-cw-detail-template="program">
        <PlatformDetailHero
          title={program.fullTitle}
          description={program.description}
          badge={`${program.tag} · ${program.duration}`}
          artwork={program.artwork}
          imageAlt={program.title}
          templateKind="program"
          primaryAction={{
            href: "#program-enroll",
            label: isMiniCourse ? "Перейти до формату" : "Записатися на програму",
          }}
          secondaryAction={{
            href: "#program-results",
            label: isMiniCourse ? "Подивитися формат" : "Подивитися деталі",
          }}
        />

        <section
          className={`${styles.container} ${styles.section}`}
          data-cw-semantic-role="offer-detail"
          data-cw-semantic-family="method-progress"
          data-cw-token-source="global-app-ds"
          id="program-results"
        >
          <div className={`${styles.split} ${styles.programOfferDetailsGrid}`}>
            <article className={styles.panel}>
              <p className={styles.label}>Що змінюємо</p>
              <h2 className={styles.title}>{isMiniCourse ? "Що дає цей короткий вхід" : "Коротко про результат"}</h2>
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

        <section
          className={`${styles.container} ${styles.section}`}
          data-cw-semantic-role="support"
          data-cw-semantic-family="support-boundary"
          data-cw-token-source="global-app-ds"
          id="program-enroll"
        >
          <div className={styles.split}>
            <article className={styles.panel}>
              <p className={styles.label}>{isMiniCourse ? "Участь" : "Запис"}</p>
              <h2 className={styles.title}>{supportTitle}</h2>
              <p className={styles.lead}>{supportLead}</p>
            </article>
            <article className={styles.formPanel}>
              <p className={styles.label}>Форма</p>
              <h2 className={styles.title}>Залишити контакти</h2>
              <LeadForm productCode={productCode} source={`platform_${program.slug}_form`} ctaPlace={`${program.slug}_offer`} />
            </article>
          </div>
        </section>

        <section
          className={`${styles.container} ${styles.section}`}
          data-cw-semantic-role="boundary"
          data-cw-semantic-family="trust-boundary"
          data-cw-token-source="global-app-ds"
        >
          <article className={styles.panel}>
            <p className={styles.label}>Межі методу</p>
            <h2 className={styles.title}>Чесний формат без медичних обіцянок</h2>
            <p className={styles.lead}>
              CenterWay працює як освітня wellness-платформа і маршрут практики. Програми не замінюють діагностику, лікування або рекомендації вашого лікаря; якщо є гострі стани, вагітність, хронічні захворювання або медикаментозна терапія, спочатку потрібна медична консультація.
            </p>
          </article>
        </section>
      </main>
    </PlatformShell>
  );
}
