# payments

Everything between "the buyer pressed pay" and "the order is paid", in one
folder. It was nine files in the root of `lib/` — `wfp.ts`, `paymentStart.ts`,
`payReturn.ts`, `paymentMeta.ts`, `checkoutFlow.ts`, `checkout.ts`, `pay.ts`,
`fulfilmentDestination.ts` and their tests — and `scripts/wfp-reconcile.mjs`
carried its own copy of the callback signature because "the TypeScript is
behind the Next build". It is not: the scripts' loader imports it directly.

- `gateway/` — the payment provider as one boundary (2026-09-26). `types.ts`
  is the interface the rest of the path speaks — an invoice request in, a
  callback's outcome out, `splits` for a provider that can route an author's
  part at source. `wayforpay.ts` and `liqpay.ts` (2026-10-03) are the two
  implementations: signatures, field names, status words. `index.ts` picks the
  active one (`PAYMENT_GATEWAY`, `wfp` or `liqpay`; unset or unknown is `wfp`)
  and the one a stored payment came from (`gatewayFor(payments.provider)`). A
  new provider is a file here plus its own callback route; nothing else should
  need to learn its name.
  LiqPay needs `LIQPAY_PUBLIC_KEY` and `LIQPAY_PRIVATE_KEY`. It splits a payment
  (`split_rules`) only when `LIQPAY_PLATFORM_RECEIVER_PUBLIC_KEY` is set, because
  a split cannot name its own initiator as a receiver, and LiqPay must have
  enabled splitting on the shop. Its `sandbox` and `wait_accept` statuses stay
  `pending`, so a test-mode payment never opens access.
- `orderStatus.ts` — the order status machine: what an outcome may write and
  what it must never overwrite. Ours, not the gateway's.
- `paymentStart.ts` — building the invoice through the gateway, `makeOrderRef`.
- `invoiceSplits.ts` — the author's part of an invoice, for a gateway that
  splits: the offer's `share_pct`, else the author's default, only when the
  author's payout account names this gateway and a receiver.
- `gatewayWebhook.ts` — the callback handler every gateway shares: order and
  payment rows, customer, Meta, receipt, sale report. It reads the body once
  (JSON or form).
- `payReturn.ts` — where the buyer lands after paying, and with what status.
- `checkoutFlow.ts`, `checkout.ts`, `pay.ts` — the checkout request and its events.
- `fulfilmentDestination.ts` — where a paid product is delivered.
- `paymentMeta.ts` — the RRN/amount/currency a callback carries.

Each gateway keeps its own callback address, because the address is baked into
every invoice it has issued: `src/app/api/wfp/webhook/route.ts` and
`src/app/api/liqpay/webhook/route.ts` are one line each into `gatewayWebhook.ts`.

**Authors' shares** are not computed here. The database writes an
`order_shares` row when an order becomes paid (trigger `orders_accrue_shares`,
`20260926010000`), from the offer's `share_pct` or the author's
`author_payout_accounts.default_share_pct`, so every path that marks an order
paid — webhook, manual sale, reconcile — accrues it the same way. With a
gateway that cannot split (WayForPay) the share is `accrued` and paid out by
hand; an order split at source carries `orders.split_at_source` and its share
is `split_at_source`.

KNOWN LIMIT of a split at source: the author's amount is computed when the
invoice is issued, and the ledger row from the configuration at the moment the
order is paid. If an offer's or author's share changes in between, the two can
disagree. Nothing snapshots the amount on the order yet; it needs a column and
a trigger change, and matters once real external authors are sold through
LiqPay.

**Refunds** are by script and full only: `wfp-refund.mjs`, `liqpay-refund.mjs`.
LiqPay's `reversed` is read as the whole order refunded.

Still WayForPay-shaped outside `gateway/`: `paymentMeta.ts` and the return
page's `extractMeta` read stored callbacks by WayForPay's field names, and the
scripts `wfp-reconcile.mjs` and `wfp-refund.mjs` are WayForPay tools by nature.
