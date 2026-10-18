# One dialog hands access out (2026-10-17)

Owner decision: «Видати доступ» and «Подарувати списку» were one act asked two
ways, and a date of the cohort's start was typed into either. They are now one
dialog, `src/components/admin/AccessGrantModal.tsx`, behind the one button on
the access tab. Mockup: the claude.ai artifact «Видача доступу».

## The form

Who → program → term → reason, then the link.

- **Who** is a table: address, name, remove. A column or a table pasted from
  Excel / Google Sheets into any address field, or a csv through «З файлу»,
  lays itself out as lines (`parsePeopleText`); an address already on a line is
  not added again but gives it its name. Up to `BULK_GRANT_LIMIT` (200).
  Five complete rows fit before this table scrolls; the sixth adds its own
  scroll, with the two-field mobile row counted as one person. The shared
  `AdminModal` stays below the visible header with a DS medium gap and keeps
  the same minimum gap above the viewport bottom. Its body scrolls while the
  title and action footer stay in view.
  Closing is the shared sprite `close` in the top-right title row, with the
  translated accessible name and `InteractionInkIcon` (`selection_family: ink`).
  The footer holds only the primary action; Escape and scrim dismissal remain.
- **Program and format.** Each choice is an active, approved saleable offer
  (`experience_offers`). It sets the payment product code, access term and
  included programs. A **group** takes its start from the stream's date and
  cannot be moved from here; its end follows the group's offer. Included
  programs receive the same source and access window.
- **Term.** «Як в оффері курсу» sends `termFromOffer: true`, so the selected format's offer
  fills the term in, counted from the grant date (or cohort start for a group).
  «Період» sends the start (`cohortStartsOn`) and an end (`expiresAt`), or
  «без кінця» (`null`, forever).
- **Reason** is what `lms_enrollments.source` records: payment → `manual` (with
  the order), gift → `bonus`, staff → `service` (migration
  `20261017180000_enrollment_source_service.sql`).
- **Link.** `/go/<program>` (see `go-program-links-2026-10-17.md`), with a copy
  button. Not shown for a promo, which has a link of its own per person.

## What depends on how many people

One line → `POST /api/admin/access/learners` (money and a role live there).
Two or more → `POST /api/admin/access/learners/bulk`, which now takes
`people: [{ email, name }]` as well as the old `emails`; a name becomes the
account's name when the account is created on the way. A payment outside the
provider is one sum for one person, so with several lines the form refuses it
and says why; a role is offered for one line only, to admins only.

## Promo

A promo grants nothing: it makes a personal link to the selected saleable
format at a discount, per person (`POST /api/admin/landing-offers`, admin
only). This works for any course with an active, approved, payable checkout
format. The operator enters a whole-number percentage for each issuance; the
current format price is snapshotted into the token. Previously issued IREM
fixed-price links remain valid. The 48-hour timer starts on first link open.
The link names the program and format, so the storefront and checkout use the
same offer code. The term is the selected format's and cannot be overridden
here.

## Grant and promo regression coverage (2026-10-18)

- `access.test.ts`: exact format identity, cohort start, inherited self-paced
  and cohort terms, included courses, manual order code, service grants,
  explicit perpetual override, and refusal of inactive/unapproved/unrelated
  formats before account or order creation. A regression found that explicit
  `expiresAt: null` did not clear an existing deadline; `grantCourse` now
  distinguishes that override from an omitted deadline.
- `accessRoutes.test.ts` and `accessBulkRoute.test.ts`: exact offer code and
  deadline semantics survive both HTTP boundaries.
- `landing/offers.test.ts`: percentage price snapshots for base, group and
  IREM formats; first-open activation without extending the timer on reread;
  invalid percentages, unrelated tokens and terminal/expired statuses.
- `api/admin/landing-offers/route.test.ts`: admin-only issuance, course/program
  identity, saleable format, validation before writes, price snapshot and audit.
- `api/pay/start/route.test.ts`: invoice and order charge the snapshot price;
  invalid, cancelled, consumed, expired or unrelated tokens use public pricing.

After integrating with current main, the full unit suite passed (2360 tests).
ESLint passed with one existing navigation warning outside this change, and all
27 static gates passed. The submit action uses the shared primary fill and normal
action width on desktop, retaining full-width stacking on phones.

## Modal geometry check (2026-10-18)

The learner lookup toolbar uses an access-specific grid: at wide widths the
search takes remaining space beside compact role/access/course tracks; below
1100px search spans its own row. Below 640px role and access share a row and
course spans the width. Shared select `width: 100%` now fills a grid track,
rather than competing with search for the entire flex row. All controls retain
the shared contour recipe, DS spacing and touch targets. Layout detector and
ESLint passed; browser inspection was unavailable because local browser use
was disabled in Work settings.

The real `AccessGrantModal` was checked in a temporary local route without
submitting API writes. At 1280×720, five rows have matching viewport/content
heights of 220px; six keep the viewport at 220px with 264px of content. At
375×1104, the corresponding heights are 440px and 528px, counting both fields
as one mobile row. The header-to-dialog and bottom clearances are each the
16px DS medium spacing. The dialog body scrolls independently of the people
list; its title and footer stay visible. ESLint and all four admin guards pass.

## What a format does and does not do

The format choice carries the stream's date (`cohortStartsOn`) and nothing
else. A grant opens **the program** (`course:<slug>`) and takes **its** offer's
term; it does not carry the format offer's identity, so a group's bonus
programs (`experience_offer_items`) and a format's own duration are not applied,
and the order of a hand-recorded payment is the program's. Doing that is a
change to `provisionAccess` and to what a manual sale records, and is left for
its own decision.

## Not done

- Promo for lead and free formats: these have no payable price to discount and
  remain unavailable.
- A group's Telegram chat is not sent by a manual grant; the bot sends it after
  a payment.
- The mockup's «автор програми» tick is not built; authorship stays on the
  Builder tab.
- «Створити акаунт» stays unticked by default, as before: creating an account
  is an outward act, and the old forms did not default it either.
