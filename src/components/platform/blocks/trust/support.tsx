import Link from "next/link";
import { LeadForm } from "@/components/platform/LeadForm";
import { Icon } from "@/components/Icon";
import { PlatformBlock } from "@/components/platform/PlatformBlock";
import styles from "@/components/platform/PlatformTrustStyles";
import { consultationCopy, expertFacts } from "@/lib/platform/content";
import type { PlatformRouteBlockProps } from "@/components/platform/blocks/types";

export function SupportForm({ route }: Pick<PlatformRouteBlockProps, "route">) {
  const productCode = route.startsWith("program-ideal-body") ? "ideal-body" : route.startsWith("program-irem") ? "irem" : "consult";

  if (route === "platform-home") {
    return (
      <PlatformBlock
        id="author"
        label="Провідник"
        title="Про автора"
        lead="Хто веде цей процес і як відбувається супровід?"
      >
        <div className={`${styles.authorPanel} ${styles.authorPanelStacked}`}>
          <div className={styles.authorCardMedia} aria-label="Євгеній Корякін">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.authorPortrait} src="/shared/img/author-evgeniy-2026-08.webp" alt="Євгеній Корякін" />
          </div>
          <div className={styles.authorPanelContent}>
            <p className={styles.lead}>
              Євгеній Корякін - дослідник і практик аюрведи, магістр комплементарної медицини та засновник CenterWay.
            </p>
            {/* All six — the cap this used to carry (`.slice(0, 4)`) was
                what left the panel shorter than the portrait beside it;
                `expertFacts` is now sized to fill it, so the slice would
                just be spelling out the array's own length. */}
            <div className={styles.factGrid}>
              {expertFacts.map((fact) => (
                <span key={fact.label}>
                  <Icon name={fact.icon} size={20} className={styles.factIcon} />
                  {fact.label}
                </span>
              ))}
            </div>
            <Link className={styles.secondaryButton} href="/consult">
              Більше про автора
            </Link>
          </div>
        </div>
      </PlatformBlock>
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
