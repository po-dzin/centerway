# Anchor scroll clearance

Platform section anchors now stop with their content one `--cw-space-md` step
below the floating topbar. The scroll margin subtracts the section or panel's
own top padding, so that padding is not counted twice. The topbar block is
declared from the shared shell geometry (including the hero top inset) and uses
the floating organs' safe-area inset and touch target on mobile.

Managed landing anchors use the existing CSS `scroll-margin` as their runtime
offset. This preserves the network navigation clearance and each section's
padding compensation when the shared script performs its repeatable instant
scroll and post-font correction.

Topbar and navigation surfaces that move on an anchor gesture use
`--cw-motion-surface` (180ms), with the platform's `--cw-ease-surface` or the
landing network's `--cw-ease-network`. Anchor scrolling itself remains an
instant jump on the platform, managed landings and network navigation menus;
other static-funnel controls keep their native smooth scrolling, whose duration
the browser determines. The
DS does not assign a duration to long document scrolling. Reduced-motion keeps
the platform and managed landing nav transitions disabled.

## Preflight / review

| Surface | semantic_role | user_question | content_source | token_source | route_boundary | selection_family |
| --- | --- | --- | --- | --- | --- | --- |
| Platform section anchors | orientation / route | Where does the linked section begin? | Existing platform sections and catalog content | Global app DS spacing and shell topbar geometry | Existing platform route | contour for CTA links; ink for navigation links |
| Managed landing anchors | orientation / offer | Where does the linked landing section begin? | Existing landing content | Existing global/network DS `scroll-margin` and navigation clearance | Existing isolated funnel route | contour for CTA links; ink for navigation links |
| Topbar, organs and landing navigation | route | How do I leave this section or reach another one? | Existing route and section labels | Existing DS motion-surface/state and surface/network easing | Existing platform and isolated funnel routes | ink for navigation labels; contour for utility triggers |

No page composition, CTA hierarchy, route boundary, surface boundary, copy, or
ink state changes. Existing native selection behavior remains unchanged.

## Browser contract

`npm run smoke:anchors:browser` covers repeat activation with the same hash,
keyboard activation, desktop and phone viewports, section-to-topbar clearance,
the 180ms response budget, long tasks, and reduced motion. The platform and all
static landing repeat suites run in the always-on browser job after build.

The suite uses the local build even when CI has a deployment URL secret. It
uses ordinary loopback for anchors; the thanks suite retains its distinct
loopback address because that address enables the payment-return redirect.
Targets at the end of a document account for the browser's maximum scroll
position. Performance samples cover click-to-first-scroll and attributable
long tasks, with separate 20-click bursts under Chromium CPU throttling ×4.
The final local run measured a maximum click-to-first-scroll latency of 55.9ms
and a maximum attributable long task of 65ms. The two 20-click bursts under
CPU throttling ×4 took 26.1ms and 22ms (180ms budget). These are interaction
regression budgets, not a whole-site performance audit.

Validated: 34 distinct Chromium browser scenarios (30 base scenarios plus four
direct-fragment/CPU edge scenarios), 2026 unit tests, production build,
typecheck, lint, canon and motion guards. Existing lint warning in
PlatformAccountMenu remains. No new canon rule or palette is introduced;
the change applies the existing geometry and motion contracts.

## CI follow-through

The first remote browser run passed 33 scenarios and exposed an 8.23px
clearance mismatch on the mobile dosha page using native smooth navigation.
Network menu fragment links now read the current CSS scroll margin and jump
instantly, preserving hash history and leaving missing targets untouched.
Managed landing capture handlers continue to own their existing navigation.
The geometric assertion keeps its 3px tolerance.

After the network menu correction, the complete local 34-scenario browser
suite, production build, lint and canon guard passed again.
