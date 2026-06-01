# Analytics Reports Bot

Status: active local implementation note
Authority: local derived contract
Date: 2026-05-01

## Scope

This note records the local operational contract for Telegram analytics reporting.

Surface: `utility`
Semantic role: `ops + automation`
User question: `which confirmed sales and period ad-performance summaries should the team receive in Telegram?`
Token source: `not applicable`
Content source: `database/API`
Route boundary: `platform routes /api/cron/analytics-reports and /api/wfp/webhook`

## Runtime Contract

The reporting flow has two outputs:

1. Immediate sale confirmation message to Telegram after `orders.status` becomes `paid` or `completed` in the WayForPay webhook.
   - primary path: direct send from webhook;
   - fallback path: enqueue `reporting:telegram-sale` job only if direct Telegram send fails.
2. Periodic Telegram summary for ad analytics and confirmed sales:
   - `daily`: previous Kyiv day
   - `weekly`: previous Monday-Sunday block, sent on Monday
   - `monthly`: previous calendar month, sent on day `1`

The delivery channel uses a dedicated analytics bot and posts into `ANALYTICS_REPORTS_CHAT_ID`.
If a forum topic is configured, messages are sent into `ANALYTICS_REPORTS_THREAD_ID`.

## Data Sources

- sales facts: `public.orders`, `public.customers`
- ad metrics: `public.analytics_meta_daily`, `public.analytics_meta_campaign_daily`
- idempotency log: `public.events`

Daily funnel is intentionally mixed but operationally reliable:

- page views come from `public.analytics_meta_daily.view_content`;
- created orders come from `public.orders`;
- confirmed payments come from `public.orders` with status `paid|completed`.

Events written by the reporting runtime:

- `tg_sale_notification_sent`
- `tg_report_sent`

## Scheduling

`vercel.json` calls `/api/cron/analytics-reports` once per day.

The route itself decides which report windows are due using `Europe/Kyiv` calendar boundaries, so one daily cron is enough for daily, weekly, and monthly dispatch.

## Report Format

Periodic Telegram report uses two depth levels:

1. `daily`:
   - `Саммари`
   - `Реклама`
   - `Вывод`
2. `weekly` and `monthly`:
   - `Саммари`
   - `Реклама`
   - `Продукты` when at least two products have confirmed paid orders in the period
   - `Топ кампаний` top 3 only
   - `Внимание` when needed
   - `Вывод`

Telegram formatting uses HTML mode for clearer visual rhythm:

- bold section headers;
- bullet points inside each section;
- plain text campaign rows without extra diagnostics counters.
- daily funnel uses `просмотр страницы -> создано заказов -> покупка`, not Meta-attributed `InitiateCheckout`.

## Environment

Required:

- `ANALYTICS_BOT_TOKEN`
- `ANALYTICS_REPORTS_CHAT_ID`

Optional:

- `ANALYTICS_REPORTS_THREAD_ID`
- `ANALYTICS_REPORTS_TIMEZONE` default `Europe/Kyiv`

## Notes

- Duplicate sends are prevented by checking `public.events`.
- If `ANALYTICS_REPORTS_CHAT_ID` or `ANALYTICS_BOT_TOKEN` is not configured, the runtime skips sending without affecting payment confirmation or analytics refresh flows.
- Supergroup IDs can be stored either as Telegram API form `-100...` or as the UI/export form `100...`; the sender normalizes `100...` into `-100...`.
- Attribution for top campaigns is intentionally conservative: Meta spend/click/purchase comes from Meta daily tables, while revenue is mapped from order-side `campaign` or `utm_campaign` first by campaign-name match and then, if needed, through `analytics_meta_adset_daily` / `analytics_meta_ad_daily` aliases back to the parent Meta campaign.
- The `Топ кампаний` block is intentionally capped at three rows; expand it only if the report contract changes explicitly.
