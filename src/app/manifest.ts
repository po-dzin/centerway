import type { MetadataRoute } from "next";

import { PLATFORM_GROUND } from "@/lib/platform/chrome";

/**
 * Installed-app identity. Without this the desktop browser falls back to a
 * screenshot of the page and the tab's own favicon when the platform is added
 * to a dock or a taskbar — which is where the old figure emblem kept surfacing
 * long after it was gone from the pages themselves.
 *
 * Icons are baked from the one mark by scripts/brand-mark-bake.mjs. Both purposes
 * ship deliberately: `any` fills the square, because desktop launchers draw the
 * file as given, while `maskable` keeps the mark inside the 80% safe zone that
 * Android's launcher shapes are guaranteed not to crop.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CenterWay",
    short_name: "CenterWay",
    description: "Курси, практики та супровід — тіло, ритм і опора у власному темпі.",
    lang: "uk",
    /**
     * The installed app opens on the SHELF, and the shelf is now the ROOT of
     * the personal host — `my.centerway.net.ua/` is rewritten to `/learn`.
     *
     * Someone who added CenterWay to their home screen has almost certainly
     * bought something, and what they tap the icon for is the course they are
     * in the middle of, not the programmes page they already bought from.
     *
     * The literal "/" matters more than it looks. This same manifest is served
     * on `www` too, where "/" is the storefront — and while the shelf lived
     * there, `start_url: "/learn"` now names a path that 308s to another
     * origin, which is an install whose entry point leaves its own scope on the
     * first tap. One relative start_url is correct on both hosts, because each
     * host's root is that host's own home.
     */
    start_url: "/",
    scope: "/",
    display: "standalone",
    // The calm ground, so the splash and the window chrome open on the same
    // surface the platform actually renders on rather than flashing white.
    background_color: PLATFORM_GROUND,
    theme_color: PLATFORM_GROUND,
    icons: [
      { src: "/cw/brand/cw-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/cw/brand/cw-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/cw/brand/cw-icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
