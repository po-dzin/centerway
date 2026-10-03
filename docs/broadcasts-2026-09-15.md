# Broadcasts — the platform's own mailing list

Schema: `supabase/migrations/20260915000000_broadcasts.sql` (applied in prod),
`supabase/migrations/20261001000000_broadcast_exclude_buyers.sql` (written
2026-10-01, **not applied yet** — waits for the owner's go-ahead).
Code: `src/lib/broadcasts/*`, `src/app/api/admin/broadcasts/**`,
`src/app/api/unsubscribe/route.ts`, `src/app/api/resend/webhook/route.ts`,
the admin screen `/admin/broadcasts`.

The schema landed on 2026-09-15 and reached production; the code it names did
not reach any branch. This document and the code were written on 2026-10-01
against that live schema, for the group launch of `way21-group` on 2026-11-01.

## What it is

Three tables, one rule:

- `messaging_subscriptions` — one row per address: consent **and** the way out.
  `unsubscribed`, `bounced`, `complained` are never mailed, whatever audience
  asks for them. Buyers and learners do not need a row to be mailed; the row
  exists when someone joined by import, or left.
- `broadcasts` — one campaign: words, audience rule, lifecycle.
- `broadcast_recipients` — the audience frozen when sending starts.

The audience is evaluated by one SQL function, `broadcast_audience(jsonb)`, for
both the live count in the editor and the snapshot the send freezes.

## The lifecycle

```
draft ──start(confirmCount)──▶ sending ──(nothing pending)──▶ sent
  │                               │
  └──delete                       └──cancel──▶ cancelled (pending → skipped)
```

- Only a draft is editable. `start` requires the number of recipients the owner
  confirmed; if the rule means a different number now, nothing is frozen and
  the new number is returned (409 `audience_changed`).
- **No scheduler.** The deployment has no crons (`vercel.json`), so the admin
  page drives the send: one batch of 50 per request, through Resend's batch
  endpoint, the next asked for when the last answers. Close the tab and the
  campaign stays `sending`; «Продовжити надсилання» resumes. A claim older than
  15 minutes is taken again (SQL), and each batch carries an idempotency key
  derived from its rows, so a re-claimed batch is not delivered twice.
- A 429 (quota) or a network failure puts the batch **back** to `pending` and
  pauses; a provider refusal marks it `failed` with the reason; «Повторити
  невдалі» sends failed rows again.

## Who may do what

`admin` creates, edits, tests, sends, stops, imports. `support` reads
everything and may unsubscribe an address by hand (what people write to support
for). Every mutation writes `audit_log`.

## Every message carries

- the platform footer with an unsubscribe link (signed token, works without
  signing in, never expires);
- `List-Unsubscribe` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
  (RFC 8058) — Gmail and Yahoo require it of bulk senders.

`GET /api/unsubscribe` only shows a confirmation page; `POST` unsubscribes.
Link scanners fetch every URL in a message, so GET must not act.

## Environment

| Variable | Needed for | If missing |
| --- | --- | --- |
| `RESEND_API_KEY` | any send | test/send answer «не налаштовано» (already set for receipts) |
| `RESEND_WEBHOOK_SECRET` | delivery stats, bounce/complaint suppression | the webhook answers 503; sending still works, stats stay at «надіслано» |
| `UNSUBSCRIBE_SECRET` | signing unsubscribe links | derived from the service-role key; set it once so a key rotation does not break links already in inboxes |
| `BROADCAST_FROM` | sender address | `CenterWay <info@send.centerway.net.ua>`, the receipts' sender |
| `LIFECYCLE_EMAILS` | lifecycle letters (below) | not `on` → no lifecycle letter goes out; a deploy alone sends nothing |
| `WELCOME_EMAILS_SINCE` | the welcome letter's start line | 2026-09-29 Kyiv; older accounts are never welcomed |
| `TELEGRAM_CHANNEL_URL`, `TELEGRAM_STREAM_CHAT_URL` | links in the lifecycle letters | the letters leave the line out |

Resend dashboard: add a webhook to `https://www.centerway.net.ua/api/resend/webhook`
for `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`,
`email.complained`, and put its signing secret in `RESEND_WEBHOOK_SECRET`.

Check the Resend plan before the first real send: the free plan allows 100
emails a day, and the launch audience is ~270. A daily quota pauses the send
(nothing is lost), but the letter would arrive over three days.

Separate sending subdomain for marketing (e.g. `news.centerway.net.ua`) keeps
a complaint wave from touching receipt deliverability; `BROADCAST_FROM` switches
to it without a code change once it is verified in Resend.

## The group launch, 2026-11-01

Audience in production on 2026-10-01 (read-only check): 271 distinct buyers
(268 of `short`), 11 registered accounts, 7 learners with active access,
2 leads, 0 subscriptions imported. SendPulse's base is not in the database yet;
import it on «Список» (it never resubscribes anyone who left).

Proposed sequence — the words are the owner's; nothing is sent without them:

1. **Announcement** — mid-October. Buyers (all products) + registered + leads,
   excluding `way21-group` buyers.
2. **Reminder** — about a week before. Same audience, same exclusion.
3. **Last call** — 2026-10-31. Same.

The group's own buyers need no campaign: the lifecycle letters «Завтра стартує»
(31.10) and «День 1» (1.11) go to them by themselves, read from the offer's
`cohort_starts_on`, once `LIFECYCLE_EMAILS=on`.

The exclusion needs `20261001000000_broadcast_exclude_buyers.sql` applied
(`npm run db:push`). Until then the key is stored and ignored, and the count on
screen includes those buyers.

## Lifecycle letters

Sent by the platform itself, from the receipts sender, not from the campaign
tool. Voice: the platform, «ми» to «ви», signed «Команда CenterWay». Code:
`src/lib/email/lifecycleEmails.ts` (words, pure) and `lifecycleRuns.ts` (who,
when). Nothing goes out until `LIFECYCLE_EMAILS=on`.

| Letter | Trigger | Where it runs |
| --- | --- | --- |
| «Вітаємо в CenterWay» | a new `platform_users` row since `WELCOME_EMAILS_SINCE` (looks back 3 days) | `/api/cron/process-jobs` |
| Receipt + stream line | paid order of a `format='group'` offer | the existing receipt |
| «Завтра стартує …» | `cohort_starts_on` = tomorrow in Kyiv | `/api/cron/lms-reminders` |
| «День 1 · …» | `cohort_starts_on` = today in Kyiv | same run |

Moving a stream's date is a data change only: the letters follow the offer's
`cohort_starts_on` (and the enrollment's, for manual grants).

**Who calls the cron routes.** Supabase `pg_cron` (migration
`20260829050000_pg_cron_scheduler.sql`), not Vercel: `cw-process-jobs` every
5 minutes and `cw-lms-reminders` daily at 06:00 UTC (09:00 Kyiv in summer
time, 08:00 after 25.10). `vercel.json` has no crons on purpose.

Stream recipients come from two roads merged by address: paid orders of a group
offer (an enrollment appears only when the course is first opened) and
enrollments carrying the start date (manual grants, buyers who already opened
it). Each letter leaves an `events` row `type='lifecycle_email_sent'` whose
`order_ref` names letter and person; the same string is the Resend
Idempotency-Key, so a letter goes out at most once.

## One mail frame

Every letter (receipt, lifecycle, sign-in code, campaign) is poured into
`src/lib/email/layout.ts`: paper ground, one warm card with the spiral and
wordmark on top (PNGs under `public/cw/brand/email/`, since Gmail shows no SVG),
serif headline, warmth primary button, thin ink link rule. Colours are the
light-side platform tokens resolved to hex; change them there, not per letter.

The sign-in code letter is generated into `supabase/templates/*.html` by
`npm run email:auth-templates` and drift-checked by `authEmails.test.ts`. The
hosted Supabase project keeps its own copy: paste the generated HTML into
Auth → Email Templates (Magic link and Confirm signup) after a change.

## Not built (on purpose, for now)

- Scheduling. `scheduled_at` and the `scheduled` status exist in the schema; a
  sender that fires on time needs a scheduler this plan does not have.
- Telegram. `channel` admits it; it is a new sender, not a new schema.
- Rich templates. The body is a small markup (paragraphs, `#`, `-`, `**`,
  links, `{{first_name|fallback}}`), escaped first, rendered by one pure
  function that the preview, the test and the send all share.

## The way in: the public subscribe form (2026-10-03)

The mirror of the unsubscribe link. `SubscribeForm`
(`src/components/platform/SubscribeForm.tsx`) sits in ONE place: the storefront
footer (`PlatformFooter`, `variant="full"`), so it is on every page of `www`
and on none of `my`. It posts to `POST /api/subscribe`
(`src/app/api/subscribe/route.ts` → `src/lib/broadcasts/subscribe.ts`).

- **Input.** `email`, `consent: true` (a box the person ticks; never
  pre-ticked), `source` = a placement id from `SUBSCRIBE_PLACEMENTS` (today only
  `footer`), and `company`, the honeypot. `ref` and UTM are read from the
  first-party cookies (`cw_ref`, `cw_utm`), never from the body.
- **Rows.** New address → `subscribed`, `source = form_<placement>` (so the
  audience editor can pick «subscribers from the footer form»). Already
  subscribed → consent refreshed, `source` kept. `unsubscribed` → subscribed
  again with a fresh consent stamp. `bounced` / `complained` → untouched.
- **One answer.** Every valid request, and a filled honeypot, gets
  `{ ok: true }`; the endpoint never says whether an address was known. Only a
  malformed request (no consent, not an address, unknown placement) gets a 400.
  Rate limit: 10 per IP per 10 minutes (`check_rate_limit`, fail-open).
- **Consent record.** Migration `20261003000000_messaging_subscription_consent.sql`
  adds `consented_at`, `consent_source`, `attribution`. **Not applied anywhere
  yet.** Until it is, the route writes the row without them (it retries on
  PGRST204/42703), so the subscription is never lost — only its paperwork. After
  applying: `npm run db:types` and drop the two casts in `subscribe.ts`.
- **No letter is sent.** Open decision: double opt-in. Without it, anyone can
  put any address on the list — including one that unsubscribed — and nothing
  proves the box was ticked by the address's owner. A confirmation link (row
  held as `pending` until pressed, which needs a new status value) would close
  both; it was left out of this pass on purpose.
