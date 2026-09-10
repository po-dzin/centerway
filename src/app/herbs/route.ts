import { createStaticLandingGet } from "@/lib/landing/staticLandingRoute";

// Canonical "Фітозбори" funnel — self-contained static landing served raw, the
// same pattern as way21/route.ts and reset-day/route.ts: it must NOT be wrapped
// in the platform layout. Sub-assets (/herbs/img, /herbs/js) are served by the
// [brand]/[...path] catch-all because "herbs" is in LANDING_STATIC_BRANDS.
//
// This route replaced a permanentRedirect to /products/herbs (removed
// 2026-08-17). The product page still exists at its own URL for the platform
// catalogue; /herbs is the funnel entry, and pointing it at the catalogue page
// meant the landing was unreachable on localhost while every other funnel was
// one path away.
//
// The CTA is a lead form ONLY WHEN THE OWNER HAS AGREED NO PRICE, and until
// 2026-09-04 this comment asserted it unconditionally while the markup carried
// `data-cw-checkout` and checkout.js charged the 1 ₴ QA amount for every click.
// The gate below is what makes the claim true, and lets it stop being true the
// day a price is set in the admin.
export const runtime = "nodejs";

export const GET = createStaticLandingGet("herbs");
