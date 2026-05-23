import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PlatformShell } from "@/components/platform/PlatformLayout";
import styles from "@/components/platform/PlatformContentStyles";
import type { PlatformOfferArtwork } from "@/lib/platform/content";
import { platformAggregateArtwork, platformMiniCourses, platformProgramOffers } from "@/lib/platform/content";

function ProgramCard({
  title,
  tag,
  description,
  href,
  visual,
  slug,
  artwork,
}: {
  title: string;
  tag: string;
  description: string;
  href: string;
  visual: string;
  slug: string;
  artwork?: PlatformOfferArtwork;
}) {
  const cardStyle = artwork?.desktop
    ? ({
        "--program-photo-image": `url("${artwork.desktop}")`,
        "--program-photo-image-mobile": `url("${artwork.mobile ?? artwork.desktop}")`,
        "--program-photo-position-desktop": artwork.desktopPosition ?? "center 20%",
        "--program-photo-position-mobile": artwork.mobilePosition ?? "center 42%",
      } as CSSProperties)
    : undefined;

  return (
    <article
      className={styles.programTile}
      data-visual={visual}
      data-program={slug}
      data-has-art={artwork?.desktop ? "true" : "false"}
      style={cardStyle}
    >
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
  const heroStyle = {
    "--hero-photo-x": "50%",
    "--hero-photo-y": "18%",
    "--hero-photo-shift-y": "0%",
    "--hero-photo-scale": "1.02",
    "--hero-photo-origin": "center top",
  } as CSSProperties;

  return (
    <PlatformShell headerMode="overlay">
      <main>
        <section
          className={styles.heroFeature}
          data-cw-topbar-tone="dark"
          data-cw-semantic-role="route-index"
          data-cw-semantic-family="guide-method"
          data-cw-token-source="global-app-ds"
          style={heroStyle}
        >
          <div className={styles.heroPhotoLayer}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.expertImage} src={platformAggregateArtwork.programs.desktop} alt="Програми CenterWay" />
          </div>
          <div className={styles.heroFeatureContent}>
            <p className={styles.heroBadge}>
              <span>Маршрути · Ритм · Глибина</span>
            </p>
            <h1 className={styles.heroFeatureTitle}>Програми CenterWay</h1>
            <p className={styles.heroFeatureLead}>
              Короткі входи, довші програми і різна глибина роботи з тілом, ритмом, харчуванням та увагою.
            </p>
            <div className={styles.heroFeatureActions}>
              <Link className={styles.heroPrimaryButton} href="#mini-courses">
                Перейти до програм
              </Link>
            </div>
          </div>
        </section>

        <section className={`${styles.container} ${styles.section} ${styles.sectionFlow}`}>
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
          id="mini-courses"
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
          <div className={styles.aggregateRail} data-rail="mini">
            {platformMiniCourses.map((program) => (
              <ProgramCard
                key={program.slug}
                title={program.title}
                tag={program.tag}
                description={program.description}
                href={program.href}
                visual={program.visual}
                slug={program.slug}
                artwork={program.artwork}
              />
            ))}
          </div>
        </section>

        <section
          id="program-catalog"
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
          <div className={styles.aggregateRail}>
            {platformProgramOffers.map((program) => (
              <ProgramCard
                key={program.slug}
                title={program.title}
                tag={program.tag}
                description={program.description}
                href={program.href}
                visual={program.visual}
                slug={program.slug}
                artwork={program.artwork}
              />
            ))}
          </div>
        </section>
      </main>
    </PlatformShell>
  );
}
