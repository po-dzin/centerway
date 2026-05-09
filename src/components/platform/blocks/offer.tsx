import Link from "next/link";
import { LeadForm } from "@/components/platform/LeadForm";
import styles from "@/components/platform/PlatformStyles";
import { currentProgram, routeLabels } from "@/components/platform/blocks/shared";
import type { PlatformGeneratedBlockProps } from "@/components/platform/blocks/types";

export function OfferHero({ programSlug }: Pick<PlatformGeneratedBlockProps, "programSlug">) {
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

export function OfferDetails({ programSlug }: Pick<PlatformGeneratedBlockProps, "programSlug">) {
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

export function OfferSupport({ route, programSlug }: Pick<PlatformGeneratedBlockProps, "route" | "programSlug">) {
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
          <LeadForm
            productCode={program?.slug === "ideal-body" ? "ideal-body" : "consult"}
            source={`platform_${route}_form`}
            ctaPlace={`${route}_offer`}
          />
        </article>
      </div>
    </section>
  );
}
