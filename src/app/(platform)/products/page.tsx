import type { Metadata } from "next";
import Link from "next/link";
import { PlatformShell } from "@/components/platform/PlatformLayout";
import { PlatformOfferCard } from "@/components/platform/PlatformOfferCard";
import styles from "@/components/platform/PlatformContentStyles";
import { platformAggregateArtwork, platformMiniCourses, platformProductOffers, platformProgramOffers } from "@/lib/platform/content";
import type { CSSProperties } from "react";

export const metadata: Metadata = {
  title: "Продукти CenterWay",
  description: "Трав'яна та природна підтримка CenterWay: як обирати продукти в контексті стану, ритму, програм і меж методу.",
  alternates: { canonical: "/products" },
};

export default function ProductsIndexPage() {
  const featuredProduct = platformProductOffers[0];
  const relatedPrograms = [...platformMiniCourses, ...platformProgramOffers].filter((program) =>
    ["mini-detox", "way21", "ideal-body"].includes(program.slug),
  );
  const heroStyle = {
    "--hero-photo-x": "50%",
    "--hero-photo-y": "16%",
    "--hero-photo-shift-y": "0%",
    "--hero-photo-scale": "1.02",
    "--hero-photo-origin": "center top",
  } as CSSProperties;

  if (!featuredProduct) {
    return (
      <PlatformShell headerMode="overlay">
        <main>
          <section className={`${styles.container} ${styles.section}`}>
            <article className={styles.panel}>
              <p className={styles.label}>Каталог</p>
              <h1 className={styles.title}>Продукти CenterWay</h1>
              <p className={styles.lead}>Зараз продуктовий агрегатор оновлюється. Поверніться трохи пізніше.</p>
            </article>
          </section>
        </main>
      </PlatformShell>
    );
  }

  return (
    <PlatformShell headerMode="overlay">
      <main>
        <section
          className={styles.heroFeature}
          data-cw-topbar-tone="dark"
          data-cw-semantic-role="route-index"
          data-cw-semantic-family="guide-trust"
          data-cw-token-source="global-app-ds"
          style={heroStyle}
        >
          <div className={styles.heroPhotoLayer}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.expertImage} src={platformAggregateArtwork.products.desktop} alt="Продукти CenterWay" />
          </div>
          <div className={styles.heroFeatureContent}>
            <p className={styles.heroBadge}>
              <span>Підтримка · Придатність · Контекст</span>
            </p>
            <h1 className={styles.heroFeatureTitle}>Продукти CenterWay</h1>
            <p className={styles.heroFeatureLead}>
              Окремий шар підтримки: трави й інші продуктові формати, які мають сенс тільки в контексті стану, режиму
              та вашого поточного маршруту.
            </p>
            <div className={styles.heroFeatureActions}>
              <Link className={styles.heroPrimaryButton} href="#product-focus">
                Дивитися трави
              </Link>
            </div>
          </div>
        </section>

        <section
          id="product-focus"
          className={`${styles.container} ${styles.section} ${styles.sectionFlow}`}
          data-cw-semantic-role="offer-index"
          data-cw-semantic-family="guide-offer"
          data-cw-token-source="global-app-ds"
        >
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.label}>Поточний фокус</p>
              <h2 className={styles.sectionTitle}>Трав&apos;яна підтримка як окремий продуктовий напрям</h2>
            </div>
          </div>
          <article className={styles.panel}>
            <div className={styles.panelIntro}>
              <p className={styles.label}>Як читати</p>
              <p className={styles.lead}>
                Тут важлива не випадкова покупка, а придатність: чи доречна така підтримка саме зараз, і як вона
                поєднується з режимом, харчуванням та програмою.
              </p>
            </div>
            <div className={styles.programFormatMeta}>
              <span>Коли доречно: м&apos;яка підтримка травлення, ритму і щоденного самопочуття.</span>
              <span>Не замінює: діагностику, лікаря або хаотичне самопризначення.</span>
              <span>Найкращий контекст: разом із програмою, режимом і зрозумілим маршрутом.</span>
            </div>
          </article>
          <div className={styles.aggregateRail} data-layout="single">
            <PlatformOfferCard
              title={featuredProduct.title}
              tag={featuredProduct.tag}
              description={featuredProduct.description}
              href={featuredProduct.href}
              visual={featuredProduct.visual}
              slug={featuredProduct.slug}
              artwork={featuredProduct.artwork}
            />
          </div>
        </section>

        <section
          id="related-programs"
          className={`${styles.container} ${styles.section} ${styles.sectionFlow}`}
          data-cw-semantic-role="route-bridge"
          data-cw-semantic-family="guide-support"
          data-cw-token-source="global-app-ds"
        >
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.label}>Пов&apos;язані маршрути</p>
              <h2 className={styles.sectionTitle}>Де продукт має найбільше сенсу</h2>
            </div>
          </div>
          <div className={styles.aggregateRail} data-rail="mini">
            {relatedPrograms.map((program) => (
              <PlatformOfferCard
                key={program.slug}
                title={program.title}
                tag={program.tag}
                description={program.description}
                href={program.href}
                visual={program.visual}
                ctaLabel="Деталі програми"
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
