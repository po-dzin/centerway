# Broadcasts — the base comes home from SendPulse (2026-09-15)

Admin → **Розсилки**. Email campaigns to our own base, with segments built from
platform data, one-click unsubscribe, bounce/complaint suppression and results.
Telegram broadcasts and the bot builder are the next steps on the same tables.

## What SendPulse was doing, and what replaces it

| SendPulse | Here |
|---|---|
| Address books imported by hand | `messaging_subscriptions` — one row per (channel, address), imported from CSV in «База» |
| Unsubscribes known only to SendPulse | the same table; `status <> 'subscribed'` is never mailed |
| Segments by list | audience rules over real data: imported base, buyers (paid orders by product), course learners, registered, leads, customer tags, exclusions |
| Campaign editor | `/admin/broadcasts/[id]`: subject, preheader, light markup body, one button, live preview, test send |
| Sending | `broadcast:send` job → Resend batch API (100 per call) |
| Stats | `broadcast_stats`: sent / failed / delivered / opened / clicked / unsubscribed / bounced / complained |

`/api/sp/webhook` (chatbot → support thread) and `/go/irem` personal offer links are
untouched: they belong to the Telegram bots, which move in the next phase.

## The moving parts

- `supabase/migrations/20260915000000_broadcasts.sql` — three tables, audience /
  freeze / claim / mark / stats functions. RLS on, no policies; service role only.
- `src/lib/broadcasts/` — `audience.ts` (rule shape), `render.ts` (letter),
  `unsubscribeToken.ts`, `csv.ts`, `subscriptions.ts`, `server.ts` (drafts,
  schedule), `sender.ts` (the job).
- Routes: `/api/admin/broadcasts/**`, `/api/admin/subscriptions`,
  `/api/unsubscribe` (public), `/api/resend/webhook` (public, signed).
- Page: `/unsubscribe` — one boundary panel; the change waits for a press.

## Rules worth not breaking

- **GET never unsubscribes.** Link scanners open every URL in a letter.
  One-click (RFC 8058) is a POST from the mail client; the page posts too.
- **An import never re-subscribes.** Known addresses are left as they are;
  unsubscribed/bounced rows in the file are applied as suppressions.
- **A complaint is not lifted by hand.** Manual resubscribe works from
  `unsubscribed` / `bounced` only.
- **Audience is frozen when sending starts**, into `broadcast_recipients`. Retry
  resumes; cancel + send again resumes; an address is mailed once per campaign.
- **`support` reads, `admin` writes.** Sending and importing are admin-only.

## Before the first real campaign

1. Apply the migration to production (`npm run db:push`, or SQL editor + journal row).
2. In Resend: verify a separate sending subdomain (e.g. `news.centerway.net.ua`)
   and set `BROADCAST_FROM`. Until then broadcasts leave from the receipts domain
   and the editor says so.
3. In Resend → Webhooks: add `https://www.centerway.net.ua/api/resend/webhook` with
   `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`,
   `email.complained`; put the signing secret in `RESEND_WEBHOOK_SECRET`.
4. Set `BROADCAST_LINK_SECRET` (any long random string).
5. Export each SendPulse address book **with the status column**, import in
   «База» with a source label per book (`sendpulse:ivem`, `sendpulse:short`…).
6. Send a test to yourself, then a small segment first — a new subdomain needs a
   few days of modest volume before a full-base send.

## Throughput

One job slice runs ≤45 s: claim 100 → one batch call → mark → 400 ms pause. That is
roughly 5–8 thousand letters a minute, far above the base. «Надіслати зараз»
starts immediately via `after()`; the queued job (5-minute cron or the admin
pulse) is the guarantee.

## Next

- **Telegram broadcasts**: `channel = 'telegram'`, address = chat id from
  `customers.tg_id`; a sender honouring 30 msg/s and `retry_after`, 403 → unsubscribed.
  Move the SendPulse-connected bots' webhooks to the platform (tokens are ours),
  import their chat ids.
- **Bot builder** (admin-only): scenarios over the same subscriptions.
- **Triggered sequences** (after test / purchase) — few, high-quality touches, per
  the premium-not-conveyor direction.
