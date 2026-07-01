import type { CSSProperties } from "react";
import Link from "next/link";
import { PlatformShell } from "@/components/platform/PlatformLayout";
import { PlatformOfferCard } from "@/components/platform/PlatformOfferCard";
import heroStyles from "@/components/platform/PlatformHeroStyles";
import offerStyles from "@/components/platform/PlatformOfferStyles";
import { platformAggregateArtwork, platformMiniCourses, platformProductOffers, platformProgramOffers } from "@/lib/platform/content";

export function PlatformProgramsIndexPage() {
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
          className={heroStyles.heroFeature}
          data-cw-topbar-tone="dark"
          data-cw-semantic-role="route-index"
          data-cw-semantic-family="guide-method"
          data-cw-token-source="global-app-ds"
          style={heroStyle}
        >
          <div className={heroStyles.heroPhotoLayer}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={heroStyles.expertImage} src={platformAggregateArtwork.programs.desktop} alt="Програми CenterWay" />
          </div>
          <div className={heroStyles.heroFeatureContent}>
            <p className={heroStyles.heroBadge}>
              <span>Маршрути · Ритм · Глибина</span>
            </p>
            <h1 className={heroStyles.heroFeatureTitle}>Програми CenterWay</h1>
            <p className={heroStyles.heroFeatureLead}>
              Короткі входи, довші програми і різна глибина роботи з тілом, ритмом, харчуванням та увагою.
            </p>
            <div className={heroStyles.heroFeatureActions}>
              <Link className={heroStyles.heroPrimaryButton} href="#mini-courses">
                Перейти до програм
              </Link>
            </div>
          </div>
        </section>

        <section className={`${offerStyles.container} ${offerStyles.section} ${offerStyles.sectionFlow}`}>
          <article className={offerStyles.panel}>
            <p className={offerStyles.label}>Як обирати</p>
            <ul className={offerStyles.timeline}>
              <li>міні-курси — для короткого входу без довгого зобов&apos;язання;</li>
              <li>програми — для глибшої роботи з тілом, харчуванням, рухом і ритмом;</li>
              <li>продукти винесені в окремий агрегатор, бо це інший тип поверхні і рішення;</li>
              <li>якщо стан неясний, спочатку тест доши або консультація.</li>
            </ul>
          </article>
        </section>

        <section
          id="mini-courses"
          className={`${offerStyles.container} ${offerStyles.section} ${offerStyles.sectionFlow}`}
          data-cw-semantic-role="offer-index"
          data-cw-semantic-family="guide-offer"
          data-cw-token-source="global-app-ds"
        >
          <div className={offerStyles.sectionHeader}>
            <div>
              <p className={offerStyles.label}>Міні-курси</p>
              <h2 className={offerStyles.sectionTitle}>Короткий вхід у практику</h2>
            </div>
          </div>
          <div className={offerStyles.aggregateRail} data-rail="mini">
            {platformMiniCourses.map((program) => (
              <PlatformOfferCard
                key={program.slug}
                title={program.title}
                tag={program.tag}
                description={program.description}
                href={program.href}
                visual={program.visual}
                slug={program.slug}
                artwork={program.artwork}
                ctaLabel="Деталі курсу"
                size="compact"
              />
            ))}
          </div>
        </section>

        <section
          id="program-catalog"
          className={`${offerStyles.container} ${offerStyles.section} ${offerStyles.sectionFlow}`}
          data-cw-semantic-role="offer-index"
          data-cw-semantic-family="guide-offer"
          data-cw-token-source="global-app-ds"
        >
          <div className={offerStyles.sectionHeader}>
            <div>
              <p className={offerStyles.label}>Основні програми</p>
              <h2 className={offerStyles.sectionTitle}>Глибші маршрути відновлення</h2>
            </div>
          </div>
          <div className={offerStyles.aggregateRail}>
            {platformProgramOffers.map((program) => (
              <PlatformOfferCard
                key={program.slug}
                title={program.title}
                tag={program.tag}
                description={program.description}
                href={program.href}
                visual={program.visual}
                slug={program.slug}
                artwork={program.artwork}
                ctaLabel="Деталі програми"
              />
            ))}
          </div>
        </section>
      </main>
    </PlatformShell>
  );
}

export function PlatformProductsIndexPage() {
  const featuredProduct = platformProductOffers[0];
  const relatedPrograms = [...platformMiniCourses, ...platformProgramOffers].filter((program) =>
    ["reset-day", "way21", "ideal-body"].includes(program.slug),
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
          <section className={`${offerStyles.container} ${offerStyles.section}`}>
            <article className={offerStyles.panel}>
              <p className={offerStyles.label}>Каталог</p>
              <h1 className={offerStyles.title}>Продукти CenterWay</h1>
              <p className={offerStyles.lead}>
                Цей каталог збирається навколо придатності й контексту. Якщо потрібен наступний крок вже зараз,
                почніть з доша-тесту або консультації.
              </p>
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
          className={heroStyles.heroFeature}
          data-cw-topbar-tone="dark"
          data-cw-semantic-role="route-index"
          data-cw-semantic-family="guide-trust"
          data-cw-token-source="global-app-ds"
          style={heroStyle}
        >
          <div className={heroStyles.heroPhotoLayer}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={heroStyles.expertImage} src={platformAggregateArtwork.products.desktop} alt="Продукти CenterWay" />
          </div>
          <div className={heroStyles.heroFeatureContent}>
            <p className={heroStyles.heroBadge}>
              <span>Підтримка · Придатність · Контекст</span>
            </p>
            <h1 className={heroStyles.heroFeatureTitle}>Продукти CenterWay</h1>
            <p className={heroStyles.heroFeatureLead}>
              Окремий шар підтримки: трави й інші продуктові формати, які мають сенс тільки в контексті стану, режиму
              та вашого поточного маршруту.
            </p>
            <div className={heroStyles.heroFeatureActions}>
              <Link className={heroStyles.heroPrimaryButton} href="#product-focus">
                Дивитися трави
              </Link>
            </div>
          </div>
        </section>

        <section
          id="product-focus"
          className={`${offerStyles.container} ${offerStyles.section} ${offerStyles.sectionFlow}`}
          data-cw-semantic-role="offer-index"
          data-cw-semantic-family="guide-offer"
          data-cw-token-source="global-app-ds"
        >
          <div className={offerStyles.sectionHeader}>
            <div>
              <p className={offerStyles.label}>Поточний фокус</p>
              <h2 className={offerStyles.sectionTitle}>Трав&apos;яна підтримка як окремий продуктовий напрям</h2>
            </div>
          </div>
          <article className={offerStyles.panel}>
            <div className={offerStyles.panelIntro}>
              <p className={offerStyles.label}>Як читати</p>
              <p className={offerStyles.lead}>
                Тут важлива не випадкова покупка, а придатність: чи доречна така підтримка саме зараз, і як вона
                поєднується з режимом, харчуванням та програмою.
              </p>
            </div>
            <div className={offerStyles.programFormatMeta}>
              <span>Коли доречно: м&apos;яка підтримка травлення, ритму і щоденного самопочуття.</span>
              <span>Не замінює: діагностику, лікаря або хаотичне самопризначення.</span>
              <span>Найкращий контекст: разом із програмою, режимом і зрозумілим маршрутом.</span>
            </div>
          </article>
          <div className={offerStyles.aggregateRail} data-layout="single">
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
          className={`${offerStyles.container} ${offerStyles.section} ${offerStyles.sectionFlow}`}
          data-cw-semantic-role="route-bridge"
          data-cw-semantic-family="guide-support"
          data-cw-token-source="global-app-ds"
        >
          <div className={offerStyles.sectionHeader}>
            <div>
              <p className={offerStyles.label}>Пов&apos;язані маршрути</p>
              <h2 className={offerStyles.sectionTitle}>Де продукт має найбільше сенсу</h2>
            </div>
          </div>
          <div className={offerStyles.aggregateRail} data-rail="mini">
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
