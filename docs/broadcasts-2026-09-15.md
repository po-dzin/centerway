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
3. **The day before** — 2026-10-31. Same.
4. **Welcome** — 2026-11-01, to buyers of `way21-group` only: where the group
   lives, what to do on day one.

The exclusion needs `20261001000000_broadcast_exclude_buyers.sql` applied
(`npm run db:push`). Until then the key is stored and ignored, and the count on
screen includes those buyers.

## Not built (on purpose, for now)

- Scheduling. `scheduled_at` and the `scheduled` status exist in the schema; a
  sender that fires on time needs a scheduler this plan does not have.
- Telegram. `channel` admits it; it is a new sender, not a new schema.
- Rich templates. The body is a small markup (paragraphs, `#`, `-`, `**`,
  links, `{{first_name|fallback}}`), escaped first, rendered by one pure
  function that the preview, the test and the send all share.
