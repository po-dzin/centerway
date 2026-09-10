import { createStaticLandingGet } from "@/lib/landing/staticLandingRoute";

// Canonical "Розвантажувальний день" mini-course funnel — light/emotional but
// premium-grade, self-contained static landing (same pattern as irem-v2/route.ts):
// raw HTML with inline CSS + js/common.js, must NOT be wrapped in the platform
// layout. Sub-assets (/reset-day/img, /reset-day/js, /reset-day/fonts) are served
// by the [brand]/[...path] catch-all because "reset-day" is in LANDING_STATIC_BRANDS.
export const runtime = "nodejs";

export const GET = createStaticLandingGet("reset-day");
