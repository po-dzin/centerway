import type { CSSProperties } from "react";
import type { PlatformOfferArtwork } from "@/lib/platform/content";

/**
 * The authoring half of the hero framing contract (the resolving half is at the
 * end of PlatformResponsive.module.css).
 *
 * A hero declares where to look on its plate and nothing else. It must never
 * set the unsuffixed --hero-photo-x/y, --hero-photo-scale or --hero-photo-origin
 * itself: those are what the contract computes per viewport, and an inline
 * declaration beats every selector, so a hero that sets them stops receiving the
 * plate swap at 560px and the aspect-ratio relief above 16:9 — which is how the
 * catalogue heroes ended up ignoring their own authored mobile focus.
 */
export type HeroFramingOptions = {
  /** Vertical focus once the viewport is wider than 16:9. Defaults to the desktop focus. */
  wideY?: string;
  /** Vertical focus once the viewport is wider than 21:9. Defaults to wideY. */
  ultrawideY?: string;
  /** Zoom over `cover` on the portrait master. Only a phone plate may ask for one. */
  mobileZoom?: string;
  /** Origin for that zoom. */
  mobileOrigin?: string;
};

const DEFAULT_FOCUS = { x: "50%", y: "20%" } as const;

function resolveFocus(position?: string) {
  if (!position) return DEFAULT_FOCUS;
  const [x, y] = position.trim().split(/\s+/);
  return {
    x: x === "center" ? "50%" : x,
    y: y ?? DEFAULT_FOCUS.y,
  };
}

export function heroFraming(
  artwork?: Pick<PlatformOfferArtwork, "desktopPosition" | "mobilePosition" | "widePosition">,
  options: HeroFramingOptions = {},
): CSSProperties {
  const desktop = resolveFocus(artwork?.desktopPosition);
  const mobile = resolveFocus(artwork?.mobilePosition ?? artwork?.desktopPosition);
  /* A course cover authors its wide focus in the builder; a hand-written hero
     passes it as an option. Same variable either way. */
  const wideY = options.wideY ?? (artwork?.widePosition ? resolveFocus(artwork.widePosition).y : undefined);

  return {
    "--hero-photo-x-desktop": desktop.x,
    "--hero-photo-y-desktop": desktop.y,
    "--hero-photo-x-mobile": mobile.x,
    "--hero-photo-y-mobile": mobile.y,
    ...(wideY ? { "--hero-photo-y-wide": wideY } : {}),
    ...(options.ultrawideY ? { "--hero-photo-y-ultrawide": options.ultrawideY } : {}),
    ...(options.mobileZoom ? { "--hero-photo-zoom-mobile": options.mobileZoom } : {}),
    ...(options.mobileOrigin ? { "--hero-photo-origin-mobile": options.mobileOrigin } : {}),
  } as CSSProperties;
}
