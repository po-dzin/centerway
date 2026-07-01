import Link from "next/link";
import styles from "@/components/platform/PlatformHeroStyles";

export function HubHero() {
  return (
    <section className={styles.heroFeature} id="center" data-cw-topbar-tone="dark">
      <div className={styles.heroPhotoLayer}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.expertImage} src="/shared/img/consult-hero-evgeniy.jpeg" alt="Євгеній Корякін" />
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
              <Link className={styles.videoActionButton} href="/dosha-test" data-kind="primary">
                Тест доши
              </Link>
              <Link className={styles.videoActionButton} href="/consult" data-kind="secondary">
                Консультація
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
