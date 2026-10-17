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
- **Program and format.** A format is a choice only for a program with several
  on sale (`experience_offers`, active and approved). A **group** takes its
  start from the stream's date and cannot be moved from here; its end follows
  the group's offer.
- **Term.** «Як в оффері курсу» sends nothing, so the offer fills the term in.
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

A promo grants nothing: it makes a personal link to the program at a discount,
per person (`POST /api/admin/landing-offers`, admin only). It exists for IREM
only (`PROMO_COURSE_SLUGS`) because `personal_offer_tokens` holds IREM's
early-bird price and nothing else; elsewhere the tab is shown dimmed with the
reason. The price and the 48-hour timer are the offer's, not typed in the form,
and the period is not offered for a promo — what the buyer gets afterwards is
the program's own offer.

## Not done

- Promo for programs other than IREM: needs a token shape that carries a
  percentage and a program, a reader on the storefront and in `/api/pay/start`.
- A group's Telegram chat is not sent by a manual grant; the bot sends it after
  a payment.
- The mockup's «автор програми» tick is not built; authorship stays on the
  Builder tab.
- «Створити акаунт» stays unticked by default, as before: creating an account
  is an outward act, and the old forms did not default it either.
