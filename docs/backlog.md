# Backlog

## Dosha Reminder (Deferred)

- Status: deferred
- Date: 2026-04-03
- Scope:
  - `dosha-reminders` cron disabled in `vercel.json` (Hobby plan restriction + delivery channels not configured yet).
  - Reminder logic stays in codebase but not scheduled automatically.
- Return when:
  - user profile model is finalized (`platform_users` + segmentation fields),
  - delivery channel is chosen and configured (email/telegram/push),
  - opt-in/opt-out and limits are approved for production.

## Platform Architecture After Wix Migration

- Status: backlog
- Date: 2026-04-25
- Decision:
  - `centerway.net.ua` becomes the platform hub: expert, method, product/program overview, dosha test, consultation, legal pages.
  - Product landings stay separated as independent funnels on their own surfaces/subdomains. They are not merged into the platform UX until a dedicated migration phase.
  - The platform must describe all products/programs in one coherent information architecture, currently from Evgeniy's expert point of view.
  - Future LMS growth must be designed as a native platform layer, not as a landing-page extension.
- Landing boundary:
  - `/reboot`, `/irem`, `/detox`, `/herbs`, `/consult` can remain acquisition funnels.
  - Funnel utility routes such as `thanks`, `pay-failed`, `public-offer`, bot links, and payment return flows remain funnel-owned.
  - The platform may link to funnels, but funnels should not depend on platform navigation.
- Future LMS backlog:
  - product/program registry: products, cohorts, modules, lessons, access rules;
  - user learning profile tied to `platform_users`;
  - course progress, lesson completion, reminders, certificates or completion states;
  - content model reusable by platform pages and LMS lessons;
  - checkout/access bridge from separated funnels into platform accounts;
  - admin tools for products, lessons, cohorts, access grants, and support.

## Legacy Terms To Retire

- Status: active cleanup
- Date: 2026-04-25
- Terms still acceptable only inside parity-safe landing migration docs/static snapshots:
  - `legacy`
  - `fallback`
  - `Wix`
  - `static landing`
  - `public/*`
  - `short`
  - `irem`
  - `s55-*`
  - `legacy-color`
- Platform-facing preferred language:
  - `separated funnel` instead of `legacy landing`;
  - `landing-static source layer` instead of `public assets`;
  - `product surface` instead of `old site`;
  - `platform hub` instead of `main site`;
  - `platform-native LMS layer` instead of `course plugin`.
