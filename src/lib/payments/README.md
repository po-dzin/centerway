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
  part at source. `wayforpay.ts` is the only implementation: its signatures,
  its field names, its status words. `index.ts` picks the active one
  (`PAYMENT_GATEWAY`, default `wfp`) and the one a stored payment came from
  (`gatewayFor(payments.provider)`). A second provider is a second file here
  plus its own callback route; nothing else should need to learn its name.
- `orderStatus.ts` — the order status machine: what an outcome may write and
  what it must never overwrite. Ours, not the gateway's.
- `paymentStart.ts` — building the invoice through the gateway, `makeOrderRef`.
- `payReturn.ts` — where the buyer lands after paying, and with what status.
- `checkoutFlow.ts`, `checkout.ts`, `pay.ts` — the checkout request and its events.
- `fulfilmentDestination.ts` — where a paid product is delivered.
- `paymentMeta.ts` — the RRN/amount/currency a callback carries.

The webhook itself is still `src/app/api/wfp/webhook/route.ts` — the address is
baked into every invoice WayForPay has issued — but it reads the callback only
through `PaymentGateway`. Its customer upsert and Telegram report belong here next.

**Authors' shares** are not computed here. The database writes an
`order_shares` row when an order becomes paid (trigger `orders_accrue_shares`,
`20260926010000`), from the offer's `share_pct` or the author's
`author_payout_accounts.default_share_pct`, so every path that marks an order
paid — webhook, manual sale, reconcile — accrues it the same way. With a
gateway that cannot split (WayForPay) the share is `accrued` and paid out by
hand; an order split at source carries `orders.split_at_source` and its share
is `split_at_source`.

Still WayForPay-shaped outside `gateway/`: `paymentMeta.ts` and the return
page's `extractMeta` read stored callbacks by WayForPay's field names, and the
two scripts (`wfp-reconcile.mjs`, `wfp-refund.mjs`) are WayForPay tools by
nature.
