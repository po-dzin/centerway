import type { Metadata } from "next";
import Link from "next/link";
import { PlatformShell } from "@/components/platform/PlatformLayout";
import styles from "@/components/platform/PlatformContentStyles";
import { platformMiniCourses, platformProgramOffers } from "@/lib/platform/content";

function ProgramCard({
  title,
  tag,
  description,
  href,
  visual,
}: {
  title: string;
  tag: string;
  description: string;
  href: string;
  visual: string;
}) {
  return (
    <article className={styles.programTile} data-visual={visual}>
      <div className={styles.programPhoto} aria-hidden="true" />
      <div className={styles.programTileBody}>
        <p className={styles.label}>{tag}</p>
        <h3>{title}</h3>
        <p>{description}</p>
        <Link className={styles.programLink} href={href}>
          Деталі програми
        </Link>
      </div>
    </article>
  );
}

export const metadata: Metadata = {
  title: "Програми CenterWay",
  description:
    "Усі програми CenterWay в одному маршруті: міні-курси, довші практики відновлення, рухові та детокс-формати.",
  alternates: { canonical: "/programs" },
};

export default function ProgramsIndexPage() {
  return (
    <PlatformShell>
      <main>
        <section
          className={`${styles.container} ${styles.hero}`}
          data-cw-semantic-role="route-index"
          data-cw-semantic-family="guide-method"
          data-cw-token-source="global-app-ds"
        >
          <div className={styles.heroPanel}>
            <div>
              <p className={styles.eyebrow}>Каталог маршрутів</p>
              <h1 className={styles.heroTitle}>Програми CenterWay</h1>
            </div>
            <p className={styles.lead}>
              Окрема дошка всіх актуальних форматів платформи: короткі входи, довші програми і маршрути, які згодом
              можна буде фільтрувати за категоріями та авторами.
            </p>
            <div className={styles.heroFooter}>
              <Link className={styles.primaryButton} href="/dosha-test">
                Почати з діагностики
              </Link>
              <Link className={styles.secondaryButton} href="/expert">
                Про автора
              </Link>
            </div>
          </div>
          <article className={styles.panel}>
            <p className={styles.label}>Як обирати</p>
            <ul className={styles.timeline}>
              <li>міні-курси — для короткого входу без довгого зобов&apos;язання;</li>
              <li>програми — для глибшої роботи з тілом, харчуванням, рухом і ритмом;</li>
              <li>продукти винесені в окремий агрегатор, бо це інший тип поверхні і рішення;</li>
              <li>якщо стан неясний, спочатку тест доши або консультація.</li>
            </ul>
          </article>
        </section>

        <section
          className={`${styles.container} ${styles.section} ${styles.sectionFlow}`}
          data-cw-semantic-role="offer-index"
          data-cw-semantic-family="guide-offer"
          data-cw-token-source="global-app-ds"
        >
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.label}>Міні-курси</p>
              <h2 className={styles.sectionTitle}>Короткий вхід у практику</h2>
            </div>
          </div>
          <div className={styles.programShowcase} data-layout="mini">
            {platformMiniCourses.map((program) => (
              <ProgramCard
                key={program.slug}
                title={program.title}
                tag={program.tag}
                description={program.description}
                href={program.href}
                visual={program.visual}
              />
            ))}
          </div>
        </section>

        <section
          className={`${styles.container} ${styles.section} ${styles.sectionFlow}`}
          data-cw-semantic-role="offer-index"
          data-cw-semantic-family="guide-offer"
          data-cw-token-source="global-app-ds"
        >
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.label}>Основні програми</p>
              <h2 className={styles.sectionTitle}>Глибші маршрути відновлення</h2>
            </div>
          </div>
          <div className={styles.programShowcase}>
            {platformProgramOffers.map((program) => (
              <ProgramCard
                key={program.slug}
                title={program.title}
                tag={program.tag}
                description={program.description}
                href={program.href}
                visual={program.visual}
              />
            ))}
          </div>
        </section>

        <section
          className={`${styles.container} ${styles.section}`}
          data-cw-semantic-role="route-bridge"
          data-cw-semantic-family="guide-support"
          data-cw-token-source="global-app-ds"
        >
          <article className={styles.panel}>
            <p className={styles.label}>Окремий family</p>
            <h2 className={styles.title}>Продукти живуть не в програмах</h2>
            <p className={styles.lead}>
              Трави і майбутні physical support surfaces винесені в окремий агрегатор, тому що їм потрібен інший шаблон: не program brochure, а product guidance з підбором, межами і route clarity.
            </p>
            <div className={styles.heroFooter}>
              <Link className={styles.primaryButton} href="/products">
                Перейти до продуктів
              </Link>
            </div>
          </article>
        </section>
      </main>
    </PlatformShell>
  );
}
