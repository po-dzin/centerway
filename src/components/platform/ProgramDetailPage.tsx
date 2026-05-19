import Link from "next/link";
import { LeadForm } from "@/components/platform/LeadForm";
import { PlatformShell } from "@/components/platform/PlatformLayout";
import styles from "@/components/platform/PlatformContentStyles";
import type { programs } from "@/lib/platform/content";

type Program = (typeof programs)[number];

export function ProgramDetailPage({ program }: { program: Program }) {
  return (
    <PlatformShell>
      <main>
        <section
          className={`${styles.container} ${styles.hero}`}
          data-cw-semantic-role="offer-orientation"
          data-cw-semantic-family="guide-proof"
          data-cw-token-source="global-app-ds"
        >
          <div className={styles.heroPanel}>
            <div>
              <p className={styles.eyebrow}>{program.tag}</p>
              <h1 className={styles.heroTitle}>{program.fullTitle}</h1>
            </div>
            <p className={styles.lead}>{program.longDescription}</p>
            <div className={styles.heroFooter}>
              <Link className={styles.primaryButton} href={program.funnelHref}>
                Перейти до формату
              </Link>
              <Link className={styles.secondaryButton} href="/programs">
                Усі програми
              </Link>
            </div>
          </div>
          <aside className={styles.programTile} data-visual={program.visual}>
            <div className={styles.programPhoto} aria-hidden="true" />
            <div className={styles.programTileBody}>
              <p className={styles.label}>{program.duration}</p>
              <h3>{program.title}</h3>
              <p>{program.description}</p>
            </div>
          </aside>
        </section>

        <section
          className={`${styles.container} ${styles.section}`}
          data-cw-semantic-role="offer-detail"
          data-cw-semantic-family="method-progress"
          data-cw-token-source="global-app-ds"
        >
          <div className={styles.split}>
            <article className={styles.panel}>
              <p className={styles.label}>Що змінюємо</p>
              <h2 className={styles.title}>Коротко про результат</h2>
              <ul className={styles.timeline}>
                {program.results.slice(0, 4).map((result) => (
                  <li key={result}>{result}</li>
                ))}
              </ul>
            </article>
            <article className={styles.formPanel}>
              <p className={styles.label}>Запит</p>
              <h2 className={styles.title}>Підібрати маршрут</h2>
              <LeadForm productCode={program.slug === "ideal-body" ? "ideal-body" : "consult"} source={`platform_${program.slug}_form`} ctaPlace={`${program.slug}_page`} />
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
