# Userflow Test Matrix

## Scope

- `short` landing
- `irem` landing
- checkout start API
- payment invoice open (WayForPay request contract)
- return routing (`thanks` / `pay-failed`)
- post-payment bot/navigation controls

## Steps and automated coverage

1. **Entry and view landing**
   - Assert CTA presence (`openModal`) on both landings.
   - Assert IREM precheckout modal/form/email/phone fields.
2. **Click CTA**
   - Assert Short JS routes to `/api/pay/start?product=short`.
   - Assert IREM JS posts to `/api/checkout/start`.
3. **Fill form (IREM)**
   - Assert payload includes `email`, `phone`, attribution fields.
4. **Save lead before payment open**
   - Assert lead record builder normalizes email/currency.
   - Assert write to `leads` table.
   - Assert fallback to `events(type=lead_captured)` when `leads` write fails.
5. **Open WayForPay**
   - Assert `CREATE_INVOICE` request is sent to `https://api.wayforpay.com/api`.
   - Assert `orders` + `events(checkout_started)` writes occur.
6. **WFP verification contract**
   - Assert approved status detection and payment event type mapping.
   - Assert metadata extraction (`rrn`, `email`, `phone`).
7. **Return handling**
   - Assert paid/failed destination URLs are deterministic and brand-specific.
8. **Thanks / pay-failed UX**
   - Assert Telegram bot links exist on both thanks pages.
   - Assert manual buttons exist (`Повернутися на сайт`, `Спробувати ще раз`).
9. **Isolation and no excess**
   - Assert no clickable links to `centerway.net.ua` in public-offer pages.
   - Assert domain text remains present as plain text.
   - Assert product resolver is deterministic (`site`/`offer_id`/fallback).

## Executed by

- `npm run userflows` (`apps/platform/tests/userflows.ts`)
- Included in `npm run ci:smoke`

