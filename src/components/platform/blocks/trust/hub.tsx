import styles from "@/components/platform/PlatformTrustStyles";
import { PlatformOfferCard } from "@/components/platform/PlatformOfferCard";
import { naturalSupportItems, platformProductOffers, proofItems } from "@/lib/platform/content";

export function HubSupport() {
  const herbs = platformProductOffers.find((product) => product.slug === "herbs");

  return (
    <section className={`${styles.container} ${styles.section} ${styles.sectionFlow}`} id="support-nature">
      <article className={styles.panel}>
        <div className={styles.panelStack}>
          <div className={`${styles.panelIntro} ${styles.panelIntroBalanced}`}>
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
          <div className={`${styles.panelIntro} ${styles.panelIntroBalanced}`}>
            <h2 className={styles.title}>Реальні зміни проходять як процес</h2>
          </div>
          {/* The group shot used to be the home hero. The hero is now the
              threshold plate, which carries atmosphere but no evidence — this
              is the one place on the platform home that shows real people and
              the author actually leading, so the photo moves here rather than
              disappearing. */}
          <figure className={styles.proofMedia}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className={styles.proofMediaImage}
              src="/shared/img/practice-group-2026-08.webp"
              width={1600}
              height={1000}
              loading="lazy"
              decoding="async"
              alt="Групова практика CenterWay — заняття з автором"
            />
            <figcaption className={styles.proofMediaCaption}>Групова практика з автором</figcaption>
          </figure>
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
