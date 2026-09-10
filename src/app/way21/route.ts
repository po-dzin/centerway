import { createStaticLandingGet } from "@/lib/landing/staticLandingRoute";

// Canonical "Шлях 21" detox funnel — premium, self-contained static landing
// (same pattern as irem-v2/route.ts): raw HTML with inline CSS + js/common.js,
// must NOT be wrapped in the platform layout. Sub-assets (/way21/img, /way21/js,
// /way21/fonts) are served by the [brand]/[...path] catch-all because "way21"
// is in LANDING_STATIC_BRANDS. Fixed price → no personal-offer branch.
export const runtime = "nodejs";

export const GET = createStaticLandingGet("way21");
