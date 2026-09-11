import { createStaticLandingGet } from "@/lib/landing/staticLandingRoute";

// Short-Перезавантаження, variant B of the /reboot A/B test: the same product,
// price and checkout flow as /reboot, rebuilt in the newer CenterWay landing
// look (the IREM theme family). Served raw like way21/reset-day — it must NOT
// go through prepareLandingHtml, whose body pass strips inline <script> tags
// and rewrites asset paths for the managed short/irem entries.
// Sub-assets (/short-b/css, /short-b/js, /short-b/fonts) are served by the
// [brand]/[...path] catch-all because "short-b" is in LANDING_STATIC_BRANDS;
// images are reused straight from /short/img.
export const runtime = "nodejs";

export const GET = createStaticLandingGet("short-b");
