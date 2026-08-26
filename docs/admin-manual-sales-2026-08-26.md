# Hand-made sales in the admin — person, payment, access, deadline

Status: implemented 2026-08-26 on the Access tab.

## Contract

- Surface: `/admin/access` → Learners tab; API `/api/admin/access/learners`.
- Semantic role: operator action, not reporting.
- User question: someone paid me outside the checkout — how do I make the
  platform agree, and until when do they have it?
- Token source: existing admin panel and button recipes; no new tokens.
- Content source: `platform_users`, `customers`, `orders`, `lms_enrollments`.
- Route boundary: admin only (`requireAdminSession`); `support` may grant
  access, roles and authorship stay admin-only as before.

## What was missing

Three gaps, all of which ended with the operator on a laptop with the
service-role key, or with a buyer told to come back later:

1. **The person.** `grantCourse` resolved the account out of `platform_users`,
   which is written at sign-in. A buyer who had never signed in could not be
   granted anything.
2. **The money.** Entitlement, the profile and every revenue report read paid
   `orders`. A transfer or a cash sale produced no order, so a hand-made grant
   was invisible to all three — the enrollment existed, the sale did not.
3. **The deadline.** `lms_enrollments.expires_at` has existed since the first
   migration and **nothing read it**. A date could be written and access stayed
   open: the worst shape for a gate, because the panel and the course disagree
   in silence.

## Decisions

**A deadline is per enrollment, not per product.** The same course is sold with
a year of access to one cohort and a month to another, and support extends one
person's date without touching anyone else's.

**A bare date means the end of that day.** `2026-09-30` is stored as
`2026-09-30T23:59:59.999Z`. "Access until the 30th" includes the 30th; end of
day is fixed in UTC, which is a couple of hours generous for Kyiv — the right
way to be wrong about a deadline.

**Expiry closes the door, it never deletes.** The row and its progress events
stay; moving the date forward returns the learner exactly where they stopped.
Revoke remains the destructive act, and still says so.

**The gate lives in `ensureEnrollment`.** The course page, the lesson page and
every progress write pass through `loadLearnerCourse`, so an expired learner
stops being able to read *and* to record, without a check per caller. The shelf
(`listLearnerCourses`) shows the card locked with `lockReason: "expired"`, which
the cabinet already had copy for, and an expired manual grant no longer opens a
draft.

**A hand-recorded payment is a real order.** It is written under the course's
own offer code (`course:<slug>`), which `resolveEntitlement` always accepts, so
the buyer owns the course by purchase and not only by the operator's word. The
reference is prefixed `manual_` so a human assertion is never mistaken for a
provider confirmation, in the orders table or in a report.

**A created account has a confirmed address.** Purchase linking matches by email
only when the provider verified it, so an unconfirmed account would own nothing
— including the very purchase it was made for. No password is set; the person
signs in through the normal doors, and an address that already has an account is
left untouched.

**A half-typed payment is refused, not dropped.** An amount with no valid
currency fails the request rather than quietly granting access without the
order, which would surface weeks later as a hole in a revenue report.

## Audit

Every step writes `audit_log` separately — `access.account.create`,
`order.manual.record`, `access.course.grant`, `access.course.deadline`. The
deadline entry records both ends of the change: "who shortened this" is the
question asked afterwards, and the previous value is the only way to answer it.

## The «Аккаунты» tab (same day)

The panel knew about every account and showed none of them. Three lists existed
and each answered a narrower question: Roles reads `user_roles` and drops the
`user` role outright, Learners reads `lms_enrollments`, Customers reads
`customers`. Someone who signed in with Google and had not yet bought or
started anything appeared in none of them — and `platform_users` was never read
as a list by any admin endpoint, only pointwise to decorate someone else's row.

That is the wrong shape for the surface built for handing out access by hand: to
grant something to a person you first have to be able to find them.

`listAccounts` reads `platform_users` — the mirror of `auth.users`, written on
every sign-in — with search and paging, and folds three counts per page rather
than per row: the role (`null` for most people, which is not the same as a
missing account), courses held, and paid orders.

Purchases are counted through customer rows matched **both** by `auth_user_id`
and by address: a purchase made before the account existed carries no link until
the buyer signs in, so counting only linked rows would report zero for exactly
the people support looks up. A row already linked to a different account is left
alone — a shared address is a support case, never a merge.

Each row grants a course inline, and admins can change the role from there, so
the tab is where you look someone up and act, not a second read-only table.

## Fields and selects (same day)

Two bugs, one cause. `.cw-input` set `width: 100%`, so every width the markup
asked for — `sm:w-64`, `sm:w-40`, `w-44` — was silently eaten: same single-class
specificity, and the DS rule is emitted last, so it won. The panel looked like a
wall of edge-to-edge fields no matter what the call sites said. Width now
belongs to the layout; `.cw-input` is the border, the ground and the focus ring.
Call sites inside a flex column or a grid cell still fill their track (flex and
grid items stretch by default); standalone ones say `w-full`.

Selects kept the platform arrow, which is painted against the border edge and
ignores padding entirely — on a wide select it drifted far from the value it
points at. `.cw-select` sets `appearance: none`, reserves the right padding and
draws the caret itself, from two gradients rather than an SVG data URI: a data
URI cannot read a CSS variable, so a hard-coded arrow would stay dark in dark
mode. Pair it with `pl-3`, not `px-3` — the right padding is the rule's, and it
is what reserves room for the caret.

The grant form is a twelve-column track instead of a row of `flex-1` fields: an
email needs room, a date does not, and stretching them equally is what made the
form read as a wall.

## Content width (same day)

The panel had no content column at all: analytics constrained itself to 80rem,
one customer page to 56rem, and every other tab ran edge to edge. On a wide
display an orders table and a course card in `/learn` stood on different axes.

`.cw-admin-content` in `globals.css` (hand-written utilities layer, outside the
codegen markers) puts every tab on `--cw-max-width` — the same 1160px guide the
learner shelf and the builder document axis already measure against. It is
applied once in the admin layout, around `{children}`, and the per-page widths
were removed: a width per tab is how they drifted apart in the first place.

The scroll viewport stays the outer element — `AdminPagination` scrolls the
panel by `[data-admin-scroll]`.

## Validation

`npx vitest run` — `src/lib/admin/access.test.ts` (module decisions against
`FakeSupabase`), `accessRoutes.test.ts` (the wire), `accessTypes.test.ts`
(deadline normalization), `src/lms-core/lms-core.test.ts` (the pure expiry
rule), `src/lib/lms/enrollmentDeadline.test.ts` (the gate itself).
