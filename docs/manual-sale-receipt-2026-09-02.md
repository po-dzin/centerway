# The hand-made sale tells the buyer

Date: 2026-09-02
Status: shipped.
Contract: `src/lib/admin/access.ts` (`provisionAccess`),
`src/app/api/admin/orders/route.ts` (PATCH), `src/lib/wfp.ts` (`ORDER_STATUSES`).

---

## 1. What happened before

Two paths in the admin panel write a paid order, and neither told the person who
paid.

**The manual sale.** `provisionAccess` makes the account, records the money,
opens the course, writes the audit entry — and stops. The buyer ended up with a
working account, at an address only the operator knew, that nobody had told them
about. `createAccount`'s own note promised them "a magic link to this address",
which the platform could not send until email sign-in shipped earlier today
(`docs/email-sign-in-2026-09-02.md`).

**The reconcile.** `PATCH /api/admin/orders` flips `orders.status`. Same silence,
plus two holes of its own:

- **No allowlist.** The status came straight out of the request body. Entitlement
  is read by `acceptedPaidOrders`, which asks only whether the status reads
  `paid` — so a typo (`payed`) silently closed a paying customer's course, and
  nothing anywhere would say why.
- **No role check above the shared staff gate.** `requireAdmin` admits `admin`
  and `support` identically. Marking an order paid grants entitlement out of
  nothing, so any support account could give away product. The codebase is
  careful about this elsewhere — `access/roles` and `catalog` both re-check
  `role !== "admin"` — this route was not.

## 2. What changed

### The receipt, from both paths

The same builder as the checkout receipt, deliberately — not a manual-sale
variant. The paragraph naming the address the purchase is tied to is the
load-bearing part of that message, and it matters *more* here: the operator
typed that address, so the buyer has not seen it written down anywhere. Two
templates would drift, and the one that drifted would be this one, because it is
sent a hundred times less often.

**From `provisionAccess`,** at the end, after the grant — the message says the
course is ready, and that is not true a moment earlier. The existing ordering
comment explains why the payment is written before the grant; the receipt is the
step that had no place in that sequence and now has the last one.

Only for a **sale**. A grant with no payment is a gift or a promo seat, and
posting "Оплату отримано" with an order number to somebody who paid nothing
would be stranger than silence. That case still has no notification; it wants
different words, not this one's.

**From `PATCH`,** only on the transition into `paid`. Re-saving an order that
already read `paid` must not mail twice (`sendPurchaseEmail` also dedupes on the
order reference, so this is belt and braces).

Neither can fail the sale: `sendPurchaseEmail` swallows its own failures and the
outcome comes back in the response, so the operator can see whether the buyer
was told without the transaction being reported as failed.

### The course row, not the offer loader

`sendManualSaleReceipt` reads `lms_courses.title` directly instead of calling
`loadPayableOffer`. The offer loader is the right answer at the checkout, where
a product code is all anyone has — but it reads through `unstable_cache`, so it
only works inside a request, and it returns `null` for a course that is unlisted
or priced at zero. Both are ordinary states for something sold by hand, and the
first made `provisionAccess` unusable outside a route handler (the unit test
caught this immediately). Here the slug is already known, so the title comes
from the row and the link points at the course rather than at the cabinet.

### Two gates on the reconcile

- **`ORDER_STATUSES`** now exists at runtime in `lib/wfp.ts`, beside the
  transition rules the callback uses. The column is free text in Postgres — no
  CHECK constraint stands behind the type — so anything writing it from outside
  the callback has to validate against something, and it must be *this*
  something. A second hand-written list would eventually disagree with the
  transition rules, and the disagreement would surface as a customer losing a
  course.
- **Confirming money is admin-only.** `refunded` and `created` stay open to
  support. The asymmetry is the one `moderateCourse` already applies to
  visibility: removing something must never be gated on the state that put it
  there. Taking access away is recoverable and auditable; giving product away is
  not.

The 403 carries a readable sentence rather than `Forbidden`, because the
reconcile modal renders the error string straight to the operator and "Forbidden"
reads as a broken button rather than as a boundary to hand to an admin.

### The audit entry says what changed

`metadata` now carries `previous_status` alongside `new_status`. It recorded only
the destination before, which makes an accidental status change unreadable after
the fact.

## 3. Not done

- **The admin UI does not know the role**, so support still sees an enabled
  "confirm paid" button and learns about the boundary from the error. Wiring the
  role into the page means a second source of truth for it in the UI (the cached
  role has a 5-minute TTL and could be stale in either direction), so the gate
  lives on the server where it belongs and the message carries the explanation.
- **A gift grant still notifies nobody.** It needs its own words, not the
  receipt's.

## 4. Tests

`src/lib/admin/ordersRoute.test.ts` (new, 11 cases) covers the allowlist, the
role split, receipt-on-transition-only, the reconcile surviving a missing buyer
address, and the audit entry. `src/lib/admin/access.test.ts` gained assertions
that a hand-made sale mails the buyer with the course link and that a gift does
not. 878 tests green.
