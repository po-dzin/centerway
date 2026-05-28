import styles from "@/components/platform/PlatformTrustStyles";
import { PlatformOfferCard } from "@/components/platform/PlatformOfferCard";
import { naturalSupportItems, platformProductOffers, proofItems } from "@/lib/platform/content";

export function HubSupport() {
  const herbs = platformProductOffers.find((product) => product.slug === "herbs");

  return (
    <section className={`${styles.container} ${styles.section} ${styles.sectionFlow}`} id="support-nature">
      <article className={styles.panel}>
        <div className={styles.panelStack}>
          <div className={styles.panelIntro}>
            <h2 className={styles.title}>Природна підтримка процесу</h2>
          </div>
          <div className={`${styles.grid3} ${styles.relaxedGrid}`}>
            {naturalSupportItems.map((item) => (
              <p className={styles.proofNote} key={item}>{item}</p>
            ))}
          </div>
          {herbs ? (
            <div className={styles.aggregateRail} data-layout="single">
              <PlatformOfferCard
                title={herbs.title}
                tag={herbs.tag}
                description={herbs.description}
                href={herbs.href}
                visual={herbs.visual}
                slug={herbs.slug}
                artwork={herbs.artwork}
              />
            </div>
          ) : null}
        </div>
      </article>
    </section>
  );
}

export function HubProof() {
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
