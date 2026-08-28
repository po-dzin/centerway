import type { PlatformOfferArtwork } from "@/lib/platform/content";
import { MEDIA_SIZES, mediaSources } from "@/lib/lms/media";

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

  // An author's cover arrives here as one URL. When it is one this application
  // stored, the smaller rendition exists and a phone should be given it — the
  // hero is full-bleed, so `sizes` is simply the viewport.
  const desktop = mediaSources(artwork.desktop);
  const mobile = artwork.mobile ? mediaSources(artwork.mobile) : undefined;

  return (
    <picture>
      {mobile ? (
        <source media={PORTRAIT_MEDIA} srcSet={mobile.srcSet ?? mobile.src} sizes={mobile.srcSet ? MEDIA_SIZES.full : undefined} />
      ) : null}
      <img
        className={className}
        src={desktop.src}
        srcSet={desktop.srcSet}
        sizes={desktop.srcSet ? MEDIA_SIZES.full : undefined}
        alt={alt}
        loading={eager ? "eager" : undefined}
        fetchPriority={eager ? "high" : undefined}
        decoding="async"
      />
    </picture>
  );
}
