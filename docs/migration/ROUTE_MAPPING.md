# Route Mapping (Legacy -> Unified Platform)

## Host routing

- `reboot.centerway.net.ua` -> `short`
- `irem.centerway.net.ua` -> `irem`
- Unknown production hosts do not map to landing content.

## Product isolation rule

- Both product sites are isolated subdomains.
- No landing links should navigate to `centerway.net.ua` main domain.
- Legal links in each product should remain inside the current subdomain.

## Rewritten legacy pages

- `/` -> `/legacy/{brand}/index.html`
- `/index.html` -> `/legacy/{brand}/index.html`
- `/index2.html` -> `/legacy/{brand}/index2.html`
- `/public-offer.html` -> `/legacy/{brand}/public-offer.html`
- `/thanks` and `/thanks.html` -> `/legacy/{brand}/thanks.html`
- `/pay-failed` and `/pay-failed.html` -> `/legacy/{brand}/pay-failed.html`

## Rewritten legacy assets

- `/css/*` -> `/legacy/{brand}/css/*`
- `/js/*` -> `/legacy/{brand}/js/*`
- `/img/*` -> `/legacy/{brand}/img/*`
- `/fonts/*` -> `/legacy/{brand}/fonts/*`
- `/libs/*` -> `/legacy/{brand}/libs/*`
- `/main-short.css` -> `/legacy/{brand}/main-short.css`
- `/media-short.css` -> `/legacy/{brand}/media-short.css`
- `/Frame` -> `/legacy/{brand}/Frame`

## Runtime routes (no rewrite)

- `/api/*`
- `/pay/return`
- `/_next/*`
- `/legacy/*`
- `/favicon.ico`
