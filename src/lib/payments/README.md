# payments

Everything between "the buyer pressed pay" and "the order is paid", in one
folder. It was nine files in the root of `lib/` — `wfp.ts`, `paymentStart.ts`,
`payReturn.ts`, `paymentMeta.ts`, `checkoutFlow.ts`, `checkout.ts`, `pay.ts`,
`fulfilmentDestination.ts` and their tests — and `scripts/wfp-reconcile.mjs`
carried its own copy of the callback signature because "the TypeScript is
behind the Next build". It is not: the scripts' loader imports it directly.

- `wfp.ts` — WayForPay: the callback signature, the order status machine.
- `paymentStart.ts` — building the invoice, `makeOrderRef`.
- `payReturn.ts` — where the buyer lands after paying, and with what status.
- `checkoutFlow.ts`, `checkout.ts`, `pay.ts` — the checkout request and its events.
- `fulfilmentDestination.ts` — where a paid product is delivered.
- `paymentMeta.ts` — the RRN/amount/currency a callback carries.

The webhook itself is still `src/app/api/wfp/webhook/route.ts`; its customer
upsert and Telegram report belong here next.
