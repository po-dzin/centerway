# Personal surface chrome on shared origins

The learner shelf and Builder are personal applications even when development
or preview serves them on the same origin as the public storefront.

- `/learn` declares `surface="personal"` on `PlatformShell`.
- Builder declares `surface="personal"` on `PlatformHeader`.
- Production host detection remains the fallback for routes whose identity is
  genuinely host-owned.
- Personal identity selects the `Мої курси` / `Білдер` navigation and the
  compact personal footer. It must not depend solely on `localhost` pretending
  to be `my.centerway.net.ua`.
- Builder workspace pages use `--cw-max-width`; readable measures remain the
  responsibility of their inner text/editor components.

This is a route-boundary rule, not a new visual recipe. All spacing, width and
chrome styling continue to come from the shared platform design-system tokens.

## Stable navigation and loading

- `Мої курси` and `Білдер` are stable application tabs on the personal surface.
  Authorization remains the destination route's responsibility; an async role
  read must not add or remove top-level navigation after hydration.
- Session restoration and content fetching use one `PlatformLoadingState`.
  The current route shell, header, footer and width stay mounted throughout.
- The loader uses the DS `LogoMark` wait motion, semantic material tokens and a
  reserved content box. It does not introduce a full-screen overlay or a second
  loading layer.
