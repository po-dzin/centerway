# The payment that is not yet confirmed

Date: 2026-09-02
Status: shipped.
Contract: `src/lib/payReturn.ts`, `src/app/(platform)/pay/return/route.ts`,
`src/app/api/pay/status/route.ts`, `src/app/(platform)/pay/pending/page.tsx`,
`src/components/platform/PayStatusPage.tsx`,
`src/components/platform/PayPendingWatcher.tsx`.

---

## 1. What the page used to say, and to whom

The browser comes back from WayForPay in a race with the server-to-server
callback. The return handler polled `orders.status` four times over 1.4 seconds
and, if it had not turned `paid` by then, answered **`failed`** — which routes to
`/pay/failed`, a page that states in so many words:

> Оплата не пройшла, і гроші не списані.

On any callback slower than a second and a half, that sentence was read by
somebody whose card had just been charged. The likely next act is paying a
second time.

The evidence that this is not theoretical is in the same database: four orders
carry both a Declined and an Approved callback on one reference (see
`docs/migration/sql/2026-09-02_payments_status_reconcile.sql`), which is what a
buyer retrying a card looks like. Elapsed time was never a fact about the
payment — only about us.

## 2. Three states, not two

`ReturnStatus` gained `pending`, and `resolveReturnStatus` decides from evidence
in order of how much each source actually knows:

1. **What the gateway told the browser.** WayForPay puts `transactionStatus` on
   the return itself; when present it is first-hand and current.
2. **What the order says.** `paid` is written only by a signature-checked
   callback, so it is proof. `refunded` is proof of the opposite.
3. **What the last stored callback said.** This is the distinction the old code
   could not draw: a callback that *arrived* and declined the payment is a real
   failure. Read through `wfpCallbackOutcome`, so WayForPay's vocabulary is
   interpreted in exactly one place.
4. **Otherwise `pending`.** Nothing has come back; we say so.

Note what is deliberately absent: elapsed time.

## 3. The waiting screen

`/pay/pending` renders `PayStatusPage status="pending"`:

- Says the bank is still confirming, that the page will update itself, and asks
  the buyer not to pay twice.
- **Fires no Purchase pixel.** A Purchase sent while we are still asking would
  report a sale that may not have happened.
- **Has no primary button.** The copy asks the buyer not to close the page;
  offering the catalogue in the loudest button on it would be telling them to
  leave. Support stays available as a secondary link.
- `PayPendingWatcher` polls `GET /api/pay/status` every 2.5s, first look
  immediate. On `paid` or `failed` it hands the browser to `/pay/return`, which
  is the single place that knows a paid course goes to its own page while a bot
  delivery goes to the confirmation screen.
- After ~2 minutes it stops and offers "check again" plus support. It never
  says the payment failed — it does not know that.

### `GET /api/pay/status?order_ref=…`

Returns one word: `{"status":"paid"|"failed"|"pending"}`. Never the amount, the
product, the buyer or the transaction. It is unauthenticated by necessity — the
person waiting has no session — so it is built to be useless to anyone not
already holding the reference they were just given. Rate limited at 60/min per
IP; `no-store`, because a CDN holding "pending" for a minute would strand a
buyer whose payment had already gone through. A read that fails answers
`pending`: a database we could not reach is not a payment that failed.

## 4. The decline now offers the way back

`/pay/failed`'s primary action was "Повернутися до програм" — a catalogue. The
product is already resolved on that page, so it is now
`/api/pay/start?product=<code>&cta_place=pay_failed_retry`. Card declines are
the single most recoverable drop in a paid funnel, and this one dead-ended.

## 5. A bug that only a browser could catch

The first version of the watcher kept the attempt count in React state and let
the polling effect re-run on each tick. Every re-run's cleanup flipped the
`cancelled` flag that the in-flight request was about to check, so each poll was
aborted a moment after it was sent: the requests went out, all of them answered
200, and **not one answer was ever acted on**. The network tab looked perfect.

The loop now lives inside a single effect run, and that is load-bearing rather
than stylistic. Unit tests cannot see this class of defect — the fix was found
by opening the page against a real paid order and watching it fail to move.

## 6. How to verify

Against production data, read-only:

1. `/pay/pending?order_ref=<a known paid ref>&product=short` → within a couple
   of seconds it should land on that product's program page showing "Оплата
   пройшла". (Verified 2026-09-02 with `short_20260412_b3f100e1`.)
2. `/pay/pending?order_ref=<a ref whose stored callback is Declined>` → lands on
   `/pay/failed`. (Verified with `short_20260227_49465d85`.)
3. `/pay/pending?order_ref=<a reference that does not exist>` → stays on the
   waiting screen, polling, and after ~2 minutes offers support.

The real test belongs in the QA block of
`docs/qa-mvp-launch-checklist-2026-09-01.md`: pay on a phone, and confirm the
buyer never sees "гроші не списані" while the money is in fact moving.
