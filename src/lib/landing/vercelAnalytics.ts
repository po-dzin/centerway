// Vercel Web Analytics snippet for statically-served landing HTML (entry + utility).
//
// These pages are served as raw HTML (renderEntryHtmlDocument / prepareLandingHtml) and
// bypass the React (funnels)/(platform) layouts that render <Analytics/>, so the insights
// script must be injected manually. This restores Web Analytics that dropped when the funnel
// hosts moved to the static architecture (2026-07-01 cutover).
//
// Requires the /_vercel/* paths (script + beacons) to bypass the funnel-host proxy rewrite —
// see INFRA_BYPASS_PREFIXES in src/lib/proxy/bypass.ts. Without that bypass the proxy rewrites
// /_vercel/insights/* onto the brand route and the script/beacons never reach Vercel.
export const VERCEL_WEB_ANALYTICS_SNIPPET =
  `<script>window.va=window.va||function(){(window.vaq=window.vaq||[]).push(arguments)};</script>` +
  `<script defer src="/_vercel/insights/script.js"></script>`;
