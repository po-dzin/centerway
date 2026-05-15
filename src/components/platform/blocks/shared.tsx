import Link from "next/link";
import { LeadForm } from "@/components/platform/LeadForm";
import styles from "@/components/platform/PlatformStyles";
import { consultationCopy, expertFacts, programPageBySlug } from "@/lib/platform/content";
import type { PlatformGeneratedBlockProps, PlatformProgramSlug } from "@/components/platform/blocks/types";

export const routeLabels: Record<string, string> = {
  "platform-home": "CenterWay",
  expert: "Євгеній Корякін",
  "program-way21": "Шлях 21",
  "program-ideal-body": "Ідеальне тіло",
  "program-irem": "IREM Гімнастика",
  "program-reboot": "Short Reboot",
  "mini-detox": "Mini Detox",
};

export function currentProgram(programSlug?: PlatformProgramSlug) {
  if (!programSlug) return null;
  return programPageBySlug[programSlug] ?? null;
}

export function SupportForm({ route }: Pick<PlatformGeneratedBlockProps, "route">) {
  const productCode = route.startsWith("program-ideal-body") ? "ideal-body" : route.startsWith("program-irem") ? "irem" : "consult";

  if (route === "platform-home") {
    return (
      <section className={`${styles.container} ${styles.section}`} id="author">
        <article className={`${styles.authorPanel} ${styles.authorPanelStacked}`}>
          <div className={styles.authorCardMedia} aria-label="Євгеній Корякін">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.authorPortrait} src="/cw/landing/img/consult-hero-evgeniy.jpeg" alt="Євгеній Корякін" />
          </div>
          <div className={styles.authorPanelContent}>
            <h2 className={styles.title}>Євгеній Корякін</h2>
            <p className={styles.lead}>
              Дослідник і практик аюрведи, магістр комплементарної медицини та засновник CenterWay. На головній він присутній як точка довіри, а не окремий рекламний блок.
            </p>
            <div className={styles.factGrid}>
              {expertFacts.slice(0, 4).map((fact) => (
                <span key={fact.label} data-icon={fact.icon}>{fact.label}</span>
              ))}
            </div>
            <Link className={styles.secondaryButton} href="/expert">
              Більше про автора
            </Link>
          </div>
        </article>
      </section>
    );
  }

  return (
    <section className={`${styles.container} ${styles.section}`} id="consultation">
      <div className={styles.consultGrid}>
        <article className={styles.panel}>
          <p className={styles.label}>Консультація</p>
          <h2 className={styles.title}>{consultationCopy.title}</h2>
          <p className={styles.lead}>{consultationCopy.text}</p>
          <ul className={styles.timeline}>
            <li>крок 1: діагностика стану і конституції (доша + ритм)</li>
            <li>крок 2: mini-entry або короткий детокс-вхід, якщо потрібен м&apos;який старт</li>
            <li>крок 3: основна програма, персональний план або глибша підтримка</li>
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

export function BoundaryBlock() {
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

export function NextStep({ route, programSlug }: Pick<PlatformGeneratedBlockProps, "route" | "programSlug">) {
  const program = currentProgram(programSlug);
  return (
    <section className={`${styles.container} ${styles.section}`}>
      <article className={styles.panel}>
        <p className={styles.label}>Наступний крок</p>
        <h2 className={styles.title}>{routeLabels[route] ?? program?.title ?? "CenterWay"}</h2>
        <p className={styles.lead}>
          Оберіть дію, яка відповідає вашому стану зараз: отримати орієнтацію через діагностику, спробувати короткий вхідний маршрут або зібрати персональний план із провідником.
        </p>
        <div className={styles.heroFooter}>
          <Link className={styles.primaryButton} href={program?.funnelHref ?? "/dosha-test"}>
            Продовжити маршрут
          </Link>
          <Link className={styles.secondaryButton} href="/consult">
            Запитати про формат
          </Link>
        </div>
      </article>
    </section>
  );
}
