# IREM Personal Offer Tokens

Date: `2026-05-18`
Scope: `irem` funnel only
Authority: local operational note

## Purpose

Replace the global promo env approach with a personal rolling offer window for launch / early-bird outreach.

The same landing route is preserved.

## Commercial Contract

- product: `irem`
- offer kind: `launch / early-bird`
- route: `/irem`
- base price: `4100 UAH`
- personal offer price: `2900 UAH`
- discount amount: `1200 UAH`
- discount percent: `30%`
- validity window: `48 hours`

## Time Rule

The 48-hour window starts on the first landing open for that personal token.

Operational meaning:

- `created_at` = when admin creates the draft link
- `issued_at` = first successful open of `/irem?offer_token=...`
- `expires_at = issued_at + 48h`

Current implementation treats first landing open as the activation event.

## Data Contract

Storage table:

- `personal_offer_tokens`

Key fields:

- `token`
- `product_code`
- `offer_id`
- `status`
- `recipient_key`
- `channel`
- `campaign`
- `amount`
- `old_amount`
- `currency`
- `issued_at`
- `expires_at`
- `metadata`

## Link Pattern

Personal links use:

```text
https://irem.centerway.net.ua/?offer_token=...
```

No cloned pages.
No `?price=...`.
No global shared promo code as the primary model.

## Runtime Behavior

- if `offer_token` is `draft`, the first landing open activates it and starts the 48h window
- if `offer_token` is valid and active, the landing shows `2900 грн` and a live `48:00:00` countdown based on `expires_at`
- when the countdown reaches zero in an already open tab, the landing switches the visible price back to base and marks the promo as expired
- if token is missing, invalid, or expired, the landing shows base price `4100 грн`
- checkout amount is resolved server-side from the same token
- the token is not trusted for client-only price mutation

## Admin API

Current issue endpoint:

- `POST /api/admin/landing-offers`

Body example:

```json
{
  "product": "irem",
  "recipient_key": "tg:123456789",
  "channel": "telegram",
  "campaign": "launch_may_2026",
  "note": "manual outreach batch A"
}
```

Batch body example:

```json
{
  "product": "irem",
  "entries": [
    {
      "recipient_key": "tg:123456789",
      "channel": "telegram",
      "campaign": "launch_may_2026",
      "note": "batch A"
    },
    {
      "recipient_key": "tg:987654321",
      "channel": "telegram",
      "campaign": "launch_may_2026",
      "note": "batch A"
    }
  ]
}
```

Response returns:

- `status`
- `offerToken`
- `issuedAt`
- `expiresAt`
- full `landingUrl`
- `batchId`
- for batch: `offers[] + summary`

## Dynamic Route

Current dynamic entrypoint:

- `GET /go/irem`

Required query params:

- one of:
  - `tgUserId`
  - `email`
- `campaign`

Optional query params:

- `channel` default `telegram` for `tgUserId`, default `email` for `email`
- `note`
- `source` default `smartsender` for `tgUserId`, default `sendpulse` for `email`
- any `utm_*` / attribution params are preserved on redirect to the final landing URL

Runtime rule:

- route builds:
  - `recipient_key = tg:{tgUserId}`
  - or `recipient_key = email:{normalizedEmail}`
- lookup scope is `product_code + campaign + recipient_key`
- if there is a live token in `draft` or `active` state, that exact token is reused
- if the `active` token is already expired, a new token is created
- different recipients never receive the same token by design

Telegram example:

```text
https://irem.centerway.net.ua/go/irem?tgUserId={{tgUserId}}&campaign=launch_may_2026&utm_source=smartsender
```

SendPulse email example:

```text
https://irem.centerway.net.ua/go/irem?email={{email}}&campaign=launch_may_2026_email&source=sendpulse&utm_source=sendpulse
```

## Runtime Status

- SQL draft promoted into runtime migration: `docs/migration/sql/2026-05-18_personal_offer_tokens.sql`
- Admin issue surface lives on: `src/app/(platform)/admin/orders/page.tsx`
- Issue endpoint lives on: `src/app/api/admin/landing-offers/route.ts`
- Dynamic bot route lives on: `src/app/go/irem/route.ts`
- Admin surface supports: single recipient, bulk paste, CSV upload
- Batch result supports: downloadable CSV with `landingPromoUrl`
- Smoke check: `npm run smoke:admin:landing-offers`
- Dynamic smoke check: `npm run smoke:landing:dynamic-offer`

## Deployment Note

If admin issuance fails with a `personal_offer_tokens` schema-cache error, production DB is behind the runtime contract.

Fastest manual repair path in Supabase SQL Editor:

- run `docs/migration/sql/2026-05-22_personal_offer_tokens_apply_all.sql`

That one script:

- creates the table if it is missing
- backfills missing columns if the table already exists in a partial shape
- restores nullable draft semantics for `issued_at` and `expires_at`
- restores defaults, constraints, indexes, and RLS policies
- reloads the PostgREST schema cache at the end

## Canon Note

This is currently a local operational contract.
If personal rolling launch offers become the durable cross-funnel rule, promote the minimum rule into RAverse landing / architecture canon.
