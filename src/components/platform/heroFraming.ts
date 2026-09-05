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
  /** Zoom over `cover` on the portrait master, for a hand-written hero. A course
      cover carries its own in `artwork.mobileScale`; this option wins over it. */
  mobileZoom?: string;
  /** Origin override for that zoom. Absent means the mobile focus itself, which
      is the origin that holds the subject still — see the contract's own note. */
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
  artwork?: Pick<
    PlatformOfferArtwork,
    "desktopPosition" | "mobilePosition" | "widePosition" | "desktopScale" | "mobileScale" | "wideScale"
  >,
  options: HeroFramingOptions = {},
): CSSProperties {
  const desktop = resolveFocus(artwork?.desktopPosition);
  const mobile = resolveFocus(artwork?.mobilePosition ?? artwork?.desktopPosition);
  /* A course cover authors its wide focus in the builder; a hand-written hero
     passes it as an option. Same variable either way. */
  const wideY = options.wideY ?? (artwork?.widePosition ? resolveFocus(artwork.widePosition).y : undefined);

  /* Only a zoom worth having is declared. `scale(1)` is the default the
     contract already carries, and writing it inline would cost every hero a
     compositing layer for a transform that changes nothing. */
  const zoom = (value: number | undefined) => (typeof value === "number" && value > 1 ? String(value) : undefined);
  const desktopZoom = zoom(artwork?.desktopScale);
  const wideZoom = zoom(artwork?.wideScale);
  const mobileZoom = options.mobileZoom ?? zoom(artwork?.mobileScale);

  return {
    "--hero-photo-x-desktop": desktop.x,
    "--hero-photo-y-desktop": desktop.y,
    "--hero-photo-x-mobile": mobile.x,
    "--hero-photo-y-mobile": mobile.y,
    ...(wideY ? { "--hero-photo-y-wide": wideY } : {}),
    ...(options.ultrawideY ? { "--hero-photo-y-ultrawide": options.ultrawideY } : {}),
    ...(desktopZoom ? { "--hero-photo-zoom-desktop": desktopZoom } : {}),
    ...(wideZoom ? { "--hero-photo-zoom-wide": wideZoom } : {}),
    ...(mobileZoom ? { "--hero-photo-zoom-mobile": mobileZoom } : {}),
    ...(options.mobileOrigin ? { "--hero-photo-origin-mobile": options.mobileOrigin } : {}),
  } as CSSProperties;
}
