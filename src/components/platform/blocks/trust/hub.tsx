import styles from "@/components/platform/PlatformTrustStyles";
import { PlatformBlock } from "@/components/platform/PlatformBlock";
import { PlatformOfferCard } from "@/components/platform/PlatformOfferCard";
import { Icon } from "@/components/Icon";
import { naturalSupportItems, platformProductOffers, proofItems } from "@/lib/platform/content";

export function HubSupport() {
  const herbs = platformProductOffers.find((product) => product.slug === "herbs");

  return (
    <PlatformBlock
      id="support-nature"
      label="Природна підтримка"
      title="Природна підтримка процесу"
      lead="Як трави і побутові ритуали підтримують процес?"
      graphic="center"
    >
      <div className={`${styles.grid3} ${styles.relaxedGrid} ${styles.blockGraphic}`}>
        {naturalSupportItems.map((item) => (
          <div className={styles.proofNote} key={item.text}>
            <span className={styles.proofNoteIcon} aria-hidden="true">
              <Icon name={item.icon} size={22} />
            </span>
            <p>{item.text}</p>
          </div>
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
    </PlatformBlock>
  );
}

export function HubProof() {
  return (
    <PlatformBlock
      id="stories"
      label="Історії"
      title="Реальні зміни проходять як процес"
      lead="Які зміни проходять інші люди в реальних умовах?"
    >
      {/* The group shot used to be the home hero. The hero is now the
          threshold plate, which carries atmosphere but no evidence — this
          is the one place on the platform home that shows real people and
          the author actually leading, so the photo moves here rather than
          disappearing. */}
      <div className={styles.proofMedia}>
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
      </div>
      <div className={`${styles.grid3} ${styles.relaxedGrid}`}>
        {proofItems.map((item) => (
          <div className={styles.proofNote} key={item.text}>
            <span className={styles.proofNoteIcon} aria-hidden="true">
              <Icon name={item.icon} size={22} />
            </span>
            <p>{item.text}</p>
          </div>
        ))}
      </div>
    </PlatformBlock>
  );
}
