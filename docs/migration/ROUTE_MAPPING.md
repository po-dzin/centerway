# Route Mapping (Landing Paths -> Unified Platform)

## Host routing

- `reboot.centerway.net.ua` -> `short`
- `irem.centerway.net.ua` -> `irem`
- Unknown production hosts do not map to landing content.

## Product isolation rule

- Both product sites are isolated subdomains.
- No landing links should navigate to `centerway.net.ua` main domain.
- Legal links in each product should remain inside the current subdomain.

## Rewritten landing pages

- `/` -> `/lps/{brand}/index.html`
- `/index.html` -> `/lps/{brand}/index.html`
- `/index2.html` -> `/lps/{brand}/index2.html`
- `/public-offer.html` -> `/lps/{brand}/public-offer.html`
- `/thanks` and `/thanks.html` -> `/lps/{brand}/thanks.html`
- `/pay-failed` and `/pay-failed.html` -> `/lps/{brand}/pay-failed.html`

## Rewritten landing assets

- `/css/*` -> `/lps/{brand}/css/*`
- `/js/*` -> `/lps/{brand}/js/*`
- `/img/*` -> `/lps/{brand}/img/*`
- `/fonts/*` -> `/lps/{brand}/fonts/*`
- `/libs/*` -> `/lps/{brand}/libs/*`
- `/main-short.css` -> `/lps/{brand}/main-short.css`
- `/media-short.css` -> `/lps/{brand}/media-short.css`
- `/Frame` -> `/lps/{brand}/Frame`

## Runtime routes (no rewrite)

- `/api/*`
- `/pay/return`
- `/_next/*`
- `/lps/*`
- `/favicon.ico`
