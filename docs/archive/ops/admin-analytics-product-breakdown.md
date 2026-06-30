# Admin Analytics Product Breakdown

Status: active local implementation note
Authority: local derived contract
Date: 2026-04-29

## Scope

This note records the local data/UI contract for `/admin/analytics` product breakdown.

Surface: `admin`
Semantic role: `orientation + proof`
User question: `what is the total order volume and revenue, and how is it split by product?`
Token source: `global app DS tokens`
Content source: `database/API`
Route boundary: `platform route /admin/analytics`

## UI Contract

Inside `/admin/analytics`, the subtab order is:

1. `overview`
2. `funnel`
3. `products`
4. `campaigns`
5. `capi`
6. `inputs_quality`

The `products` subtab shows:

- total orders for the selected period;
- paid/completed orders for the selected period;
- total revenue for the selected period;
- a table grouped by `orders.product_code`.

## API Contract

`GET /api/admin/analytics` returns:

```ts
summary: {
  totalOrders: number;
  totalPaidOrders: number;
  totalRevenue: number;
}

products: Array<{
  product_code: string;
  total_orders: number;
  paid_orders: number;
  total_revenue: number;
  share_revenue_percent: number;
}>
```

`share_revenue_percent` is computed from paid/completed revenue within the selected period only.

## Notes

- Product breakdown is computed from the same in-period `orders` dataset as campaign analytics to avoid drift between totals and product rows.
- Unknown or empty `product_code` values are normalized to `unknown` on the API side and rendered as a neutral fallback label in UI.
