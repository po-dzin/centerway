import Link from "next/link";
import { LeadForm } from "@/components/platform/LeadForm";
import {
  consultationCopy,
  doshas,
  educationTimeline,
  expertFacts,
  expertStory,
  featuredPrograms,
  personalFacts,
  programPageBySlug,
  proofItems,
} from "@/lib/platform/content";
import styles from "./PlatformStyles";

type PlatformGeneratedBlockProps = {
  route: string;
  variant: string;
  programSlug?: string;
};

const routeLabels: Record<string, string> = {
  "platform-home": "CenterWay",
  expert: "Євгеній Корякін",
  "program-way21": "Шлях 21",
  "program-ideal-body": "Ідеальне тіло",
  "program-irem": "IREM Гімнастика",
  "mini-detox": "Mini Detox",
};

function currentProgram(programSlug?: keyof typeof programPageBySlug) {
  if (!programSlug) return null;
  return programPageBySlug[programSlug] ?? null;
}

function ProgramTile({ program }: { program: (typeof featuredPrograms)[number] }) {
  return (
    <article className={styles.programTile} data-visual={program.visual}>
      <div className={styles.programPhoto} aria-hidden="true" />
      <div className={styles.programTileBody}>
        <p className={styles.label}>{program.tag}</p>
        <h3>{program.title}</h3>
        <p>{program.description}</p>
        <Link className={styles.programLink} href={program.href}>
          {program.duration} - перейти
        </Link>
      </div>
    </article>
  );
}

function HomeHero() {
  return (
    <section className={styles.heroFeature}>
      <div className={styles.heroPhotoLayer}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.expertImage} src="/cw/landing/img/consult-hero-evgeniy.jpeg" alt="Євгеній Корякін" />
      </div>
      <div className={styles.heroFeatureContent}>
        <p className={styles.heroBadge}>
          <span>Психологія · Ріст · Сенс</span>
        </p>
        <h1 className={styles.heroFeatureTitle}>CenterWay</h1>
        <p className={styles.heroFeatureLead}>
          Шлях до себе - не пошук нової особистості, а повернення до своєї істинної природи через тіло, увагу і практику.
        </p>
        <div className={styles.heroFeatureActions}>
          <Link className={styles.heroPrimaryButton} href="#intro-video">
            Почати шлях
          </Link>
          <Link className={styles.heroSecondaryButton} href="/expert#about-author" data-cw-glass="control">
            <span>Про автора</span>
          </Link>
        </div>
      </div>
      <div className={styles.heroProofGrid}>
        <div data-cw-glass="panel">
          <strong>12</strong>
          <span>років практики</span>
        </div>
        <div data-cw-glass="panel">
          <strong>3</strong>
          <span>напрями опори</span>
        </div>
        <div data-cw-glass="panel">
          <strong>1</strong>
          <span>центр руху</span>
        </div>
      </div>
    </section>
  );
}

function HomeIntro() {
  return (
    <section className={`${styles.container} ${styles.section}`} id="intro-video">
      <div className={styles.videoSection}>
        <div className={styles.videoPanel}>
          <iframe
            className={styles.videoEmbed}
            src="https://www.youtube-nocookie.com/embed/6jmhNMj_Duo?rel=0&modestbranding=1"
            title="Вступне відео CenterWay"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
        </div>
        <aside className={styles.videoAside}>
          <p className={styles.label}>Вступ</p>
          <h2 className={styles.title}>Спочатку - зрозуміти свій стан</h2>
          <p className={styles.lead}>
            Перед програмами, тестами і консультаціями важливо побачити систему цілком: як тіло, харчування, увага і звички формують маршрут відновлення.
          </p>
          <Link className={styles.secondaryButton} href="/dosha-test">
            Пройти тест
          </Link>
        </aside>
      </div>
    </section>
  );
}

function HomeMethod() {
  return (
    <section className={`${styles.container} ${styles.section}`} id="method">
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.label}>Метод</p>
          <h2 className={styles.sectionTitle}>Існують різні типи людей. Дізнайся, який ти</h2>
        </div>
        <Link className={styles.secondaryButton} href="/dosha-test">
          Пройти тест
        </Link>
      </div>
      <div className={styles.grid3}>
        {doshas.map((dosha, index) => (
          <article className={styles.card} data-tone={index === 0 ? "proof" : index === 1 ? "policy" : "support"} key={dosha.title}>
            <span className={styles.lineIcon} data-icon={index === 0 ? "body" : index === 1 ? "growth" : "sense"} aria-hidden="true" />
            <p className={styles.label}>{dosha.title}</p>
            <p>{dosha.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function HomeRoutes() {
  return (
    <section className={`${styles.container} ${styles.section}`} id="programs">
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.label}>Програми</p>
          <h2 className={styles.sectionTitle}>Виберіть напрям свого шляху</h2>
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

function HomeTrust() {
  return (
    <section className={`${styles.container} ${styles.section}`} id="proof">
      <article className={styles.panel}>
        <p className={styles.label}>Довіра</p>
        <h2 className={styles.title}>Результати і підтвердження</h2>
        <div className={styles.grid3}>
          {proofItems.map((item) => (
            <p className={styles.proofNote} key={item}>{item}</p>
          ))}
        </div>
      </article>
    </section>
  );
}

function SupportForm({ route }: { route: string }) {
  const productCode = route.startsWith("program-ideal-body") ? "ideal-body" : route.startsWith("program-irem") ? "irem" : "consult";
  return (
    <section className={`${styles.container} ${styles.section}`} id="consultation">
      <div className={styles.consultGrid}>
        <article className={styles.panel}>
          <p className={styles.label}>Консультація</p>
          <h2 className={styles.title}>{consultationCopy.title}</h2>
          <p className={styles.lead}>{consultationCopy.text}</p>
          <ul className={styles.timeline}>
            <li>визначення вашого типу і поточного стану</li>
            <li>індивідуальні особливості харчування, очищення і режиму</li>
            <li>маршрут: консультація, тест доши, програма або практика</li>
          </ul>
        </article>
        <article className={styles.formPanel}>
          <p className={styles.label}>Залишити запит</p>
          <h2 className={styles.title}>Заповніть форму</h2>
          <LeadForm productCode={productCode} source={`platform_${route}_form`} ctaPlace={`${route}_support`} />
        </article>
      </div>
    </section>
  );
}

function ExpertHero() {
  return (
    <section className={`${styles.container} ${styles.hero}`} id="about-author">
      <div className={styles.heroPanel}>
        <div>
          <p className={styles.eyebrow}>Про автора</p>
          <h1 className={styles.heroTitle}>Євгеній Корякін</h1>
        </div>
        <div className={styles.copyStack}>
          {expertStory.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <div className={styles.heroFooter}>
          <Link className={styles.primaryButton} href="/#consultation">
            Запит на консультацію
          </Link>
          <Link className={styles.secondaryButton} href="/#programs">
            Програми
          </Link>
        </div>
      </div>
      <aside className={styles.mediaPanel}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.expertImage} src="/cw/landing/img/consult-hero-evgeniy.jpeg" alt="Євгеній Корякін" />
        <div className={styles.mediaCaption}>
          <strong>12 років практики</strong>
          <span>Аюрведа, дієтологія, детоксикація, йога і комплементарна медицина.</span>
        </div>
      </aside>
    </section>
  );
}

function ExpertProof() {
  return (
    <section className={`${styles.container} ${styles.section}`}>
      <div className={styles.grid2}>
        <article className={styles.panel}>
          <p className={styles.label}>Профіль</p>
          <h2 className={styles.title}>Практика CenterWay</h2>
          <div className={styles.factGrid}>
            {expertFacts.map((fact) => (
              <span key={fact}>{fact}</span>
            ))}
          </div>
        </article>
        <article className={styles.panel}>
          <p className={styles.label}>Особисто</p>
          <h2 className={styles.title}>Факти про мене</h2>
          <ul className={styles.timeline}>
            {personalFacts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}

function ExpertPath() {
  return (
    <section className={`${styles.container} ${styles.section}`}>
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.label}>Освіта і шлях</p>
          <h2 className={styles.sectionTitle}>Від технічної освіти до системи CenterWay</h2>
        </div>
      </div>
      <ol className={styles.timeline}>
        {educationTimeline.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
    </section>
  );
}

function OfferHero({ programSlug }: { programSlug?: keyof typeof programPageBySlug }) {
  const program = currentProgram(programSlug);
  if (!program) return null;
  return (
    <section className={`${styles.container} ${styles.hero}`}>
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
          <Link className={styles.secondaryButton} href="/#programs">
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
  );
}

function OfferDetails({ programSlug }: { programSlug?: keyof typeof programPageBySlug }) {
  const program = currentProgram(programSlug);
  if (!program) return null;
  return (
    <section className={`${styles.container} ${styles.section}`}>
      <div className={styles.split}>
        <article className={styles.panel}>
          <p className={styles.label}>Що змінюємо</p>
          <h2 className={styles.title}>Коротко про результат</h2>
          <ul className={styles.timeline}>
            {program.results.slice(0, 5).map((result) => (
              <li key={result}>{result}</li>
            ))}
          </ul>
        </article>
        <article className={styles.panel}>
          <p className={styles.label}>Формат</p>
          <h2 className={styles.title}>{program.duration}</h2>
          <p className={styles.lead}>{program.description}</p>
          <Link className={styles.secondaryButton} href={program.funnelHref}>
            Деталі маршруту
          </Link>
        </article>
      </div>
    </section>
  );
}

function OfferSupport({ route, programSlug }: { route: string; programSlug?: keyof typeof programPageBySlug }) {
  const program = currentProgram(programSlug);
  return (
    <section className={`${styles.container} ${styles.section}`}>
      <div className={styles.split}>
        <article className={styles.panel}>
          <p className={styles.label}>Підтримка</p>
          <h2 className={styles.title}>Підібрати маршрут</h2>
          <p className={styles.lead}>
            Якщо не ясно, чи підходить {program?.title ?? routeLabels[route]}, краще почати з короткого запиту і уточнити формат без тиску.
          </p>
        </article>
        <article className={styles.formPanel}>
          <p className={styles.label}>Запит</p>
          <h2 className={styles.title}>Залишити контакти</h2>
          <LeadForm productCode={program?.slug === "ideal-body" ? "ideal-body" : "consult"} source={`platform_${route}_form`} ctaPlace={`${route}_offer`} />
        </article>
      </div>
    </section>
  );
}

function BoundaryBlock() {
  return (
    <section className={`${styles.container} ${styles.section}`}>
      <article className={styles.panel}>
        <p className={styles.label}>Межі методу</p>
        <h2 className={styles.title}>Чесний формат без медичних обіцянок</h2>
        <p className={styles.lead}>
          CenterWay працює як освітня wellness-платформа і маршрут практики. Програми не замінюють діагностику, лікування або рекомендації лікаря; якщо є гострі стани, вагітність, хронічні захворювання або медикаментозна терапія, спочатку потрібна медична консультація.
        </p>
      </article>
    </section>
  );
}

function NextStep({ route, programSlug }: { route: string; programSlug?: keyof typeof programPageBySlug }) {
  const program = currentProgram(programSlug);
  return (
    <section className={`${styles.container} ${styles.section}`}>
      <article className={styles.panel}>
        <p className={styles.label}>Наступний крок</p>
        <h2 className={styles.title}>{routeLabels[route] ?? program?.title ?? "CenterWay"}</h2>
        <p className={styles.lead}>Оберіть дію, яка найкраще відповідає вашому стану зараз: подивитись маршрут, пройти тест або залишити запит.</p>
        <div className={styles.heroFooter}>
          <Link className={styles.primaryButton} href={program?.funnelHref ?? "/dosha-test"}>
            Продовжити маршрут
          </Link>
          <Link className={styles.secondaryButton} href="/#consultation">
            Запитати про формат
          </Link>
        </div>
      </article>
    </section>
  );
}

export function PlatformGeneratedBlock({ route, variant, programSlug }: PlatformGeneratedBlockProps) {
  if (variant === "home.hero") return <HomeHero />;
  if (variant === "home.intro") return <HomeIntro />;
  if (variant === "home.method") return <HomeMethod />;
  if (variant === "home.route-map") return <HomeRoutes />;
  if (variant === "home.trust") return <HomeTrust />;
  if (variant === "support.form") return <SupportForm route={route} />;

  if (variant === "expert.hero") return <ExpertHero />;
  if (variant === "expert.proof") return <ExpertProof />;
  if (variant === "expert.path") return <ExpertPath />;

  if (variant === "offer.hero") return <OfferHero programSlug={programSlug} />;
  if (variant === "offer.details") return <OfferDetails programSlug={programSlug} />;
  if (variant === "offer.support") return <OfferSupport route={route} programSlug={programSlug} />;
  if (variant === "boundary") return <BoundaryBlock />;
  if (variant === "next-step") return <NextStep route={route} programSlug={programSlug} />;

  return null;
}
