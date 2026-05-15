import Link from "next/link";
import styles from "@/components/platform/PlatformStyles";
import { featuredPrograms, miniCourses, naturalSupportItems, programs, proofItems } from "@/lib/platform/content";

type ProgramTileData = Pick<(typeof programs)[number], "description" | "duration" | "href" | "tag" | "title" | "visual">;

function ProgramTile({ program, compact = false }: { program: ProgramTileData; compact?: boolean }) {
  return (
    <article className={styles.programTile} data-size={compact ? "compact" : "default"} data-visual={program.visual}>
      <div className={styles.programPhoto} aria-hidden="true" />
      <div className={styles.programTileBody}>
        <p className={styles.label}>{program.tag}</p>
        <h3>{program.title}</h3>
        <p>{program.description}</p>
        <Link className={styles.programLink} href={program.href}>
          {compact ? "Деталі курсу" : "Деталі програми"}
        </Link>
      </div>
    </article>
  );
}

export function HomeHero() {
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

export function HomeIntro() {
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

export function HomeRoutes() {
  return null;
}

export function HomeMiniCourses() {
  return (
    <section className={`${styles.container} ${styles.section} ${styles.sectionFlow}`} id="mini-courses">
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>М&apos;який вхід без довгого зобов&apos;язання</h2>
        </div>
      </div>
      <div className={styles.programShowcase} data-layout="mini">
        {miniCourses.map((program) => (
          <ProgramTile key={program.title} compact program={program} />
        ))}
      </div>
    </section>
  );
}

export function HomePrograms() {
  return (
    <section className={`${styles.container} ${styles.section} ${styles.sectionFlow}`} id="programs">
      <div className={styles.sectionHeader}>
        <div>
          <h2 className={styles.sectionTitle}>Глибші програми для тіла, харчування і ритму</h2>
        </div>
      </div>
      <div className={styles.programShowcase}>
        {featuredPrograms.map((program) => (
          <ProgramTile key={program.title} program={program} />
        ))}
      </div>
    </section>
  );
}

export function HomeNaturalSupport() {
  return (
    <section className={`${styles.container} ${styles.section} ${styles.sectionFlow}`} id="support-nature">
      <article className={styles.panel}>
        <div className={styles.panelStack}>
          <div className={styles.supportPanelLayout}>
            <div className={styles.panelIntro}>
              <h2 className={styles.title}>Природна підтримка процесу</h2>
            </div>
            <div className={styles.herbVisual} aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
          <div className={`${styles.grid3} ${styles.relaxedGrid}`}>
            {naturalSupportItems.map((item) => (
              <p className={styles.proofNote} key={item}>{item}</p>
            ))}
          </div>
        </div>
      </article>
    </section>
  );
}

export function HomeProof() {
  return (
    <section className={`${styles.container} ${styles.section} ${styles.sectionFlow}`} id="stories">
      <article className={styles.panel}>
        <div className={styles.panelStack}>
          <div className={styles.panelIntro}>
            <h2 className={styles.title}>Реальні зміни проходять як процес</h2>
          </div>
          <div className={`${styles.grid3} ${styles.relaxedGrid}`}>
            {proofItems.map((item) => (
              <p className={styles.proofNote} key={item}>{item}</p>
            ))}
          </div>
        </div>
      </article>
    </section>
  );
}
