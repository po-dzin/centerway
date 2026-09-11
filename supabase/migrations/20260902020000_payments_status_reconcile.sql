-- CenterWay: four paid orders that revenue reporting cannot see.
--
-- APPLIED 2026-09-02 to production over the session pooler. The BEFORE query
-- returned exactly the four rows named below and nothing else; the UPDATE
-- returned those same four order references; the AFTER query then showed only
-- two pairings left in the whole table — created/created 475 and paid/paid 275
-- — with zero rows where the order says paid and the payment does not. Paid
-- payments went 271 → 275, which is the four sales rejoining revenue.
--
-- This is a data repair, not a schema change, and it touches money rows. It is
-- idempotent: a second run matches nothing.
-- Contract: src/app/api/wfp/webhook/route.ts, src/lib/wfp.ts
--
-- ─── WHY ────────────────────────────────────────────────────────────────────
--
-- `payments` carries a unique index on (provider, order_ref), so exactly one
-- row exists per order and the FIRST callback to arrive wins. Every later
-- callback for that order collapsed into a 23505 conflict and the webhook
-- discarded it.
--
-- That is invisible until a buyer's card is declined and they immediately
-- retry on the same invoice, which WayForPay allows. Then the stored row is
-- the DECLINE, permanently, while `orders` goes on to say `paid`. The events
-- log shows the pattern plainly — Declined, then Approved twenty seconds to a
-- minute later, on one order reference:
--
--   short_20260412_b3f100e1   Declined 16:57:19 → Approved 16:58:39
--   short_20260425_4d744be1   Declined 05:33:42 → Approved 05:33:59
--   short_20260427_e0849080   Declined 19:46:52 → Approved 19:47:10
--   short_20260612_f7f53dc8   Declined 04:18:10 → Approved 04:19:15
--
-- WHAT IT COSTS. `/api/admin/analytics` and `/api/admin/purchases/backfill`
-- both select payments by `status IN ('paid','completed')`. These four sales
-- are simply absent from revenue there. They are real, settled, and the
-- customers received their courses — `orders` is correct throughout, which is
-- why nobody noticed.
--
-- THE CODE SIDE IS ALREADY FIXED. As of the same work cycle the webhook treats
-- a 23505 as "a row exists that may be out of date" and moves it forward under
-- the same no-downgrade guard the order uses, so no new row can freeze this
-- way. This file only repairs the four that already did.
--
-- WHAT THIS DELIBERATELY DOES NOT DO. It does not touch `raw_payload`. The
-- stored payload is genuinely the declined attempt's, and we cannot recover the
-- approved one — WayForPay's callback was never stored, precisely because of
-- the bug being repaired. Rewriting the status while leaving the payload is the
-- honest end state: the status says what happened, `events` holds the sequence,
-- and the payload is labelled by this comment rather than quietly invented.
-- `provider_tx_id` is left alone for the same reason, and because it carries a
-- unique index that a rewrite could collide with.

-- ─── BEFORE: expect exactly the four rows listed above ──────────────────────

SELECT o.order_ref,
       o.status  AS order_status,
       p.status  AS payment_status,
       p.raw_payload ->> 'transactionStatus' AS stored_callback,
       o.created_at
FROM orders o
JOIN payments p ON p.order_ref = o.order_ref AND p.provider = 'wfp'
WHERE o.status = 'paid'
  AND p.status <> 'paid'
ORDER BY o.created_at;

-- ─── REPAIR ─────────────────────────────────────────────────────────────────
--
-- Narrow on purpose: only where the ORDER says paid, so the order row is doing
-- the asserting and this statement is only making the payment row agree with a
-- decision that was already made and already acted on. Idempotent — a second
-- run matches nothing.

UPDATE payments p
SET status = 'paid'
FROM orders o
WHERE p.order_ref = o.order_ref
  AND p.provider = 'wfp'
  AND o.status = 'paid'
  AND p.status <> 'paid';

-- ─── AFTER: expect zero rows from the BEFORE query, and 275 paid payments ───

SELECT o.status AS order_status, p.status AS payment_status, count(*)
FROM orders o
JOIN payments p ON p.order_ref = o.order_ref AND p.provider = 'wfp'
GROUP BY 1, 2
ORDER BY 3 DESC;
