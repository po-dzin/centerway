# Cutover Checklist

## Pre-cutover

- [ ] `reboot` and `irem` preview deployments open landing root `/`
- [ ] `GET /api/health` returns `{ ok: true }`
- [ ] `GET /api/pay/start?product=short&format=json` returns pay URL
- [ ] `POST /api/checkout/start` returns `paymentUrl`, `order_ref`, `lead_id`
- [ ] `/thanks` and `/pay-failed` render with payment meta from query params
- [ ] Purchase/PurchaseFailed dedupe works on reload

## DNS switch

- [ ] `reboot.centerway.net.ua` points to unified deployment
- [ ] `irem.centerway.net.ua` points to unified deployment

## Post-cutover (48-72h)

- [ ] Monitor `orders` row creation rate
- [ ] Monitor `events` `checkout_started` ingestion
- [ ] Verify payment success/failure redirects
- [ ] Verify Meta Pixel events for both products

