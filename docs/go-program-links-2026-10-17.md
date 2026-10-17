# `/go/<program>` — one link per program (2026-10-17)

Owner decision: the link an admin copies after granting access, and the link a
personal promo travels in, are one shape — `/go/<program>` — for every program.

## What it does

`src/app/go/[program]/route.ts`

| Request | Lands on |
|---|---|
| `/go/way21` | `https://my.centerway.net.ua/way21` — the course. Not signed in → the standard door in front of `/learn`, which returns to the course (`src/lib/auth/signInReturn.ts`). The link opens no access; the grant does. |
| `/go/irem?offer_token=…` | `https://www.centerway.net.ua/programs/irem?offer_token=…` — the storefront page, which prints the personal price and carries the token to `/pay/checkout` → `/api/pay/start`, which charges it. |
| `/go/irem?tgUserId=…&campaign=…` (or `email=`) | Issues/reuses a personal IREM price (the old `/go/irem` contract, kept for links already sent by SmartSender/SendPulse), then as above. |
| unknown name, draft course | `https://www.centerway.net.ua/programs` |

The name resolves as the program's public address (`reboot`, `irem`), the
course row's slug (`short`, `irem-gymnastics`), or any alias in
`experience_aliases` (`idealne-tilo`, …). Query fields other than identity
(`email`, `tgUserId`, `campaign`, `channel`, `note`, `source`, `recipient_key`)
are carried on — utm and click ids survive.

`/go/` is in `INFRA_BYPASS_PREFIXES` (`src/lib/proxy/bypass.ts`), so the link
works on every host.

## What changed around it

- `src/app/go/irem/route.ts` is gone; its job is a branch of the general route.
- Issued IREM offers (`landingUrl` in the admin orders screen) are now
  `https://www.centerway.net.ua/go/irem?offer_token=…`. They used to be the
  platform home `/?offer_token=…`, which read no token: every personal link
  issued that way showed the public price.
- `resolvePersonalPrice` (`src/lib/landing/offers.ts`) is the one question the
  storefront page and the checkout ask; `withPersonalPrice`
  (`src/lib/platform/offerCommerce.ts`) puts the price and the token on the
  page's checkout link. Structured data keeps the public amount.

## Not done

- Personal prices exist for IREM only (`personal_offer_tokens`, fixed
  2900/4100/48h in `offers.ts`). The admin «Видати доступ» redesign plans
  promo links for every program; a token for another product is ignored today
  and the storefront shows its public price.
- The admin modal itself (mockup: claude.ai artifact «Видача доступу») is not
  built; this change is the address it will print.
