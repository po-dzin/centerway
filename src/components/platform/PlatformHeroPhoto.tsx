"use client";

import { useEffect, useState } from "react";

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
  // An author's cover arrives here as one URL. When it is one this application
  // stored, the smaller rendition exists and a phone should be given it — the
  // hero is full-bleed, so `sizes` is simply the viewport.
  const desktop = artwork?.desktop ? mediaSources(artwork.desktop) : undefined;
  const mobile = artwork?.mobile ? mediaSources(artwork.mobile) : undefined;
  const [mobileStatus, setMobileStatus] = useState<{ src: string; ready: boolean } | null>(null);

  /* A `picture > source` cannot recover when its own URL was deleted from
     Storage: the browser has already selected it before the fallback `img` can
     help. Verify the optional portrait master first; until it loads, the
     desktop cover remains in place and uses its authored mobile crop. */
  useEffect(() => {
    if (!mobile?.src) return;
    let active = true;
    const probe = new window.Image();
    probe.onload = () => {
      if (active) setMobileStatus({ src: mobile.src, ready: true });
    };
    probe.onerror = () => {
      if (active) setMobileStatus({ src: mobile.src, ready: false });
    };
    probe.src = mobile.src;
    return () => {
      active = false;
    };
  }, [mobile?.src]);

  if (!desktop) return null;

  return (
    <picture>
      {mobile && mobileStatus?.src === mobile.src && mobileStatus.ready ? (
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
