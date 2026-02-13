# Unified API Contracts

## `POST /api/checkout/start`

### Request body

```json
{
  "site": "irem",
  "offer_id": "irem_main_4100",
  "email": "name@example.com",
  "phone": "+380XXXXXXXXX",
  "event_id": "uuid",
  "value": 4100,
  "currency": "UAH",
  "utm_source": "meta",
  "utm_medium": "cpc",
  "utm_campaign": "campaign",
  "utm_content": "adset",
  "utm_term": "keyword",
  "fbclid": "fbclid",
  "cr": "cr",
  "lv": "lv",
  "referrer": "https://...",
  "page_url": "https://...",
  "user_agent": "..."
}
```

### Response body

```json
{
  "ok": true,
  "paymentUrl": "https://secure.wayforpay.com/...",
  "order_ref": "irem_20260213_ab12cd34",
  "product": "irem",
  "lead_id": "lead_irem_20260213_ab12cd34",
  "lead_saved": "leads"
}
```

## Backward compatibility

- `GET /api/pay/start?product=short|irem` is still supported.
- If `format=json` is provided, the endpoint returns both `url` and `paymentUrl`.
