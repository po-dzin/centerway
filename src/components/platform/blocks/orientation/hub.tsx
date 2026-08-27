import Link from "next/link";
import { Icon } from "@/components/Icon";
import styles from "@/components/platform/PlatformHeroStyles";
import { PlatformHeroPhoto } from "@/components/platform/PlatformHeroPhoto";
import { DOSHA_TEST_ROUTE } from "@/lib/platform/tests";

export function HubHero() {
  return (
    <section className={styles.heroFeature} id="center" data-cw-topbar-tone="dark">
      <div className={styles.heroPhotoLayer}>
        {/* A PORTRAIT MASTER, not a crop. The landscape plate is a scene built
            across the frame — doorway right, sandals at the foot of the wall
            left — and a portrait viewport shows about a third of its width, so
            the phone used to render the inside of the doorway and nothing else:
            no wall, no threshold, no shoes. The portrait frame is the same room
            recomposed for the tall shape, with the doorway lifted above the
            lower third because the copy is bottom-anchored there. Swapped by
            PlatformHeroPhoto on the same 560px line every other platform hero
            uses. */}
        <PlatformHeroPhoto
          artwork={{
            desktop: "/shared/img/home-hero-threshold-2026-08-v12.webp",
            mobile: "/shared/img/home-hero-threshold-2026-08-v12-portrait.webp",
          }}
          alt="Поріг: вхід у практику CenterWay"
          className={styles.expertImage}
          eager
        />
      </div>
      <div className={styles.heroFeatureContent}>
        <p className={styles.heroBadge}>
          <span>Тіло · Ритм · Опора</span>
        </p>
        <h1 className={styles.heroFeatureTitle}>CenterWay</h1>
        <p className={styles.heroFeatureLead}>
          Шлях до себе - не пошук нової особистості, а повернення до своєї істинної природи через тіло, увагу і практику.
        </p>
        <div className={styles.heroFeatureActions}>
          <Link className={styles.heroPrimaryButton} href="#intro-video">
            Почати шлях
          </Link>
        </div>
      </div>
    </section>
  );
}

export function HubIntro() {
  return (
    <section className={`${styles.container} ${styles.section}`} id="signals">
      <div className={styles.videoSection} data-cw-hub-intro="layout">
        <div className={styles.videoPanel} id="intro-video" data-cw-hub-intro="video">
          <iframe
            className={styles.videoEmbed}
            src="https://www.youtube-nocookie.com/embed/6jmhNMj_Duo?rel=0&modestbranding=1"
            title="Вступне відео CenterWay"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
        <aside className={styles.videoAside} id="diagnostics" data-cw-hub-intro="aside">
          <div className={styles.videoDecisionIntro}>
            <p className={styles.label}>Орієнтація · перший крок</p>
            <h2 className={styles.title}>Спочатку - зрозуміти свій стан</h2>
            <p className={styles.videoDecisionText}>Перед програмами, тестами і консультаціями важливо побачити систему цілком.</p>
          </div>
          <div className={styles.videoDecisionRail}>
            <div className={styles.videoActionGrid} data-cw-hub-intro="actions">
              <Link className={styles.videoActionPrimary} href={DOSHA_TEST_ROUTE}>
                Тест доші
              </Link>
              <Link className={styles.videoActionSecondary} href="/consult">
                Консультація
              </Link>
            </div>
            {/* These two are entries in the diagnostics catalogue, not the
                catalogue — the panel names the rest rather than leaving the
                topbar as the only route to it. */}
            <Link className={styles.videoDecisionMore} href="/tests">
              Усі тести
              <Icon className={styles.videoDecisionMoreArrow} name="arrow-right" size={18} />
            </Link>
          </div>
        </aside>
      </div>
    </section>
  );
}
