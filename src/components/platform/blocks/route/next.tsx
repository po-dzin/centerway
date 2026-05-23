import Link from "next/link";
import styles from "@/components/platform/PlatformContentStyles";
import { currentProgram, routeLabels } from "@/components/platform/blocks/route/context";
import type { PlatformGeneratedBlockProps } from "@/components/platform/blocks/types";

export function NextStep({ route, programSlug }: Pick<PlatformGeneratedBlockProps, "route" | "programSlug">) {
  const program = currentProgram(programSlug);
  const primaryHref = program ? "#program-enroll" : "/dosha-test";
  const secondaryHref = program ? "/expert" : "/dosha-test";
  const secondaryLabel = program ? "Поставити питання автору" : "Пройти діагностику";

  return (
    <section className={`${styles.container} ${styles.section}`}>
      <article className={styles.panel}>
        <p className={styles.label}>Наступний крок</p>
        <h2 className={styles.title}>{routeLabels[route] ?? program?.title ?? "CenterWay"}</h2>
        <p className={styles.lead}>
          Оберіть дію, яка відповідає вашому стану зараз: отримати орієнтацію через діагностику, спробувати короткий вхідний маршрут або зібрати персональний план із провідником.
        </p>
        <div className={styles.heroFooter}>
          <Link className={styles.primaryButton} href={primaryHref}>
            Продовжити маршрут
          </Link>
          <Link className={styles.secondaryButton} href={secondaryHref}>
            {secondaryLabel}
          </Link>
        </div>
      </article>
    </section>
  );
}
