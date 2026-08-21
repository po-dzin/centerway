import Link from "next/link";
import styles from "@/components/platform/PlatformRouteStyles";
import { currentProgram, routeLabels } from "@/components/platform/blocks/route/context";
import type { PlatformRouteBlockProps } from "@/components/platform/blocks/types";
import { DOSHA_TEST_ROUTE } from "@/lib/platform/tests";

export function NextStep({ route, programSlug }: Pick<PlatformRouteBlockProps, "route" | "programSlug">) {
  const program = currentProgram(programSlug);
  const primaryHref = program ? "#program-enroll" : DOSHA_TEST_ROUTE;
  const secondaryHref = program ? "/expert" : DOSHA_TEST_ROUTE;
  const secondaryLabel = program ? "Поставити питання автору" : "Пройти діагностику";

  return (
    <section className={`${styles.container} ${styles.section}`}>
      <article className={styles.panel}>
        <p className={styles.label}>Наступний крок</p>
        <h2 className={styles.title}>{routeLabels[route] ?? program?.title ?? "CenterWay"}</h2>
        <p className={styles.lead}>
          Оберіть дію, яка відповідає вашому стану зараз: отримати орієнтацію через діагностику, спробувати коротку вхідну програму або зібрати персональний план із провідником.
        </p>
        <div className={styles.heroFooter}>
          <Link className={styles.primaryButton} href={primaryHref}>
            Продовжити
          </Link>
          <Link className={styles.secondaryButton} href={secondaryHref}>
            {secondaryLabel}
          </Link>
        </div>
      </article>
    </section>
  );
}
