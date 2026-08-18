import type { PlatformOfferArtwork } from "@/lib/platform/content";

/**
 * Below this width the platform hero switches to portrait framing
 * (PlatformResponsive.module.css). A 16:10 plate covered into a portrait
 * viewport shows only about a third of its width, so a scene built across the
 * frame loses most of itself there. Where a portrait master exists it has to
 * swap on exactly this line — hence one component rather than a <picture>
 * copied into every hero.
 */
const PORTRAIT_MEDIA = "(max-width: 560px)";

type PlatformHeroPhotoProps = {
  artwork?: PlatformOfferArtwork;
  alt: string;
  /** The hero photo class of the calling surface, usually styles.expertImage. */
  className: string;
  /** Above-the-fold heroes should not lazy-load. */
  eager?: boolean;
};

export function PlatformHeroPhoto({ artwork, alt, className, eager }: PlatformHeroPhotoProps) {
  if (!artwork?.desktop) return null;

  return (
    <picture>
      {artwork.mobile ? <source media={PORTRAIT_MEDIA} srcSet={artwork.mobile} /> : null}
      <img
        className={className}
        src={artwork.desktop}
        alt={alt}
        loading={eager ? "eager" : undefined}
        fetchPriority={eager ? "high" : undefined}
        decoding="async"
      />
    </picture>
  );
}
