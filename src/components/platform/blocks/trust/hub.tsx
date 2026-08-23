import styles from "@/components/platform/PlatformTrustStyles";
import { PlatformBlock, PlatformBlockLink } from "@/components/platform/PlatformBlock";
import { PlatformOfferCard } from "@/components/platform/PlatformOfferCard";
import { Icon } from "@/components/Icon";
import { platformProductOffers, proofItems } from "@/lib/platform/content";

/**
 * The products block — a shelf, not an essay about herbs.
 *
 * It used to be three icon notes and a card: the notes argued the case for
 * herbal support in prose, and the single card sat under them as an
 * afterthought. Two things were wrong with that. The prose belonged to the
 * product and not to the section, so it could not travel to /products or to a
 * detail page without being retyped; and the shape was herb-specific — a second
 * product would have needed a second set of notes written above it, or would
 * have arrived under an argument about herbs.
 *
 * The block is now the general form the marketplace needs: it renders whatever
 * `platformProductOffers` holds, and each card carries its own context in
 * `points`. Herbs are one card of one product, which is exactly what they are.
 */
export function HubSupport() {
  const products = platformProductOffers;
  if (products.length === 0) return null;

  return (
    <PlatformBlock
      id="support-nature"
      label="Продукти"
      title="Природна підтримка процесу"
      lead="Що з продуктів доречно поруч із програмою і режимом?"
      graphic="center"
      headActions={<PlatformBlockLink href="/products" label="Усі продукти" />}
    >
      {/* One product is one card and not a lonely cell; more than one is a rail.
          The same switch the aggregate pages use, so the block does not change
          shape when the catalogue grows. */}
      <div className={styles.aggregateRail} data-layout={products.length === 1 ? "single" : undefined}>
        {products.map((product) => (
          <PlatformOfferCard
            key={product.slug}
            title={product.title}
            tag={product.tag}
            description={product.description}
            href={product.href}
            visual={product.visual}
            slug={product.slug}
            artwork={product.artwork}
            points={product.points}
          />
        ))}
      </div>
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
