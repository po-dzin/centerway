import Link from "next/link";
import styles from "@/components/platform/PlatformHeroStyles";

export function HubHero() {
  return (
    <section className={styles.heroFeature} id="center" data-cw-topbar-tone="dark">
      <div className={styles.heroPhotoLayer}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.expertImage} src="/cw/landing/img/consult-hero-evgeniy.jpeg" alt="Євгеній Корякін" />
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
      <div className={styles.videoSection}>
        <div className={styles.videoPanel} id="intro-video">
          <iframe
            className={styles.videoEmbed}
            src="https://www.youtube-nocookie.com/embed/6jmhNMj_Duo?rel=0&modestbranding=1"
            title="Вступне відео CenterWay"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
        <aside className={styles.videoAside} id="diagnostics">
          <h2 className={styles.title}>Спочатку - зрозуміти свій стан</h2>
          <p className={styles.lead}>
            Перед програмами, тестами і консультаціями важливо побачити систему цілком: як тіло, харчування, увага і звички формують процес відновлення.
          </p>
          <div className={styles.videoActionGrid}>
            <Link className={styles.videoActionCard} href="/dosha-test" data-icon="focus">
              <span className={styles.lineIcon} data-icon="focus" aria-hidden="true" />
              <span>
                <strong>Тест доши</strong>
                <small>Коротка самодіагностика, щоб побачити конституцію, ритм і перший напрям.</small>
              </span>
            </Link>
            <Link className={styles.videoActionCard} href="/consult" data-icon="guide">
              <span className={styles.lineIcon} data-icon="guide" aria-hidden="true" />
              <span>
                <strong>Консультація</strong>
                <small>Живий розбір стану, якщо потрібен персональний підхід і опора у виборі.</small>
              </span>
            </Link>
          </div>
        </aside>
      </div>
    </section>
  );
}
