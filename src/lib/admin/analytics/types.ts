/* The shapes the analytics route sends, and the few this dashboard derives.
 *
 * Lifted out of the page (2026-09-11), which was 2583 lines and held its types,
 * its date arithmetic, its two components and its nineteen sections in one
 * file. Nothing here is new: this is the same block, in a file `lib` can read.
 *
 * The page is behind a Google sign-in, so it cannot be checked by opening it —
 * only by testing it, which is the whole reason its rules keep moving into
 * `lib`. See dashboardMode.ts, which made the same move first. */

import type { AnalyticsPayload } from "@/lib/analytics/dashboard";
import type { DoshaAnalyticsPayload } from "@/lib/analytics/dosha";

export type FunnelData = {
  date: string;
  leads_count: number;
  orders_created: number;
  orders_paid: number;
  total_revenue: number;
};

export type CampaignData = {
  source_campaign: string;
  total_orders: number;
  paid_orders: number;
  total_revenue: number;
  view_content: number;
  impressions: number;
  reach: number;
  spend: number;
  currency: string;
};

export type ProductData = {
  product_code: string;
  product_title: string | null;
  total_orders: number;
  paid_orders: number;
  total_revenue: number;
  share_revenue_percent: number;
};

/* Derived from the engine: the route sends totalOrders as number | null and
   avgConversionRate as string | number, which the hand-written copy narrowed. */
export type AnalyticsSummary = AnalyticsPayload["summary"];

export type CapiEventName = "ViewContent" | "InitiateCheckout" | "Purchase";

export type CapiEventStats = {
  event_name: CapiEventName;
  total: number;
  success: number;
  pending: number;
  running: number;
  failed: number;
  last_seen_at: string | null;
};

export type CapiOverview = {
  total: number;
  success: number;
  pending: number;
  running: number;
  failed: number;
};

export type FunnelChain = {
  view_content: number;
  initiate_checkout: number;
  purchase: number;
  access_granted: number;
  view_to_checkout_percent: number;
  checkout_to_purchase_percent: number;
  purchase_to_access_percent: number;
};

export type MarketingInputs = {
  reach: number;
  impressions: number;
  clicks: number;
  spend: number;
  currency: string;
  period_label: string | null;
  updated_at: string | null;
  source?: "meta" | "manual";
};

export type UnifiedKpis = {
  cpa: number;
  cpc: number;
  ctr_percent: number;
  roas: number;
  roi_percent: number;
};

export type QualityGaps = {
  snapshot_date: string;
  paid_missing_fbc_raw: number;
  paid_recoverable_fbc_from_fbclid: number;
  paid_truly_missing_fbc: number;
  paid_missing_fbclid: number;
  paid_missing_fbp: number;
  paid_missing_page_url: number;
  paid_missing_client_ip: number;
  paid_missing_client_ua: number;
};

export type AnalyticsFreshness = {
  local_view_content_last_at: string | null;
  local_scroll_depth_50_last_at: string | null;
  orders_created_last_at: string | null;
  orders_paid_last_at: string | null;
  capi_last_sent_at: string | null;
  meta_last_synced_at: string | null;
  pixel_daily_last_synced_at: string | null;
  quality_snapshot_date: string | null;
};

export type QualitySeriesRow = {
  date: string;
  paid_orders: number;
  missing_fbc_raw: number;
  recoverable_fbc_from_fbclid: number;
  truly_missing_fbc: number;
  missing_fbclid: number;
  missing_fbp: number;
  missing_page_url: number;
  missing_client_ip: number;
  missing_client_ua: number;
};

export type PurchaseTransport = {
  total_paid_orders: number;
  success: number;
  pending: number;
  running: number;
  failed: number;
  missing_job: number;
  stale_pending: number;
  client_signal: number;
  missing_client_signal: number;
  last_success_at: string | null;
};

export type DiagnosticsPanelKey = "freshness" | "quality" | "purchase_transport";

export type DoshaAnalytics = DoshaAnalyticsPayload;

export type LeadsSummary = {
  new_in_period: number;
  won_in_period: number;
  lost_in_period: number;
  open_total: number;
  conversion_percent: number;
};

export type LearningSummary = {
  granted_in_period: number;
  started_in_period: number;
  started_percent: number;
  active_total: number;
  expiring_14d: number;
  expired_total: number;
};

/* The engine's own payload type, not a copy of it: a field the route stops
   sending fails here at compile time instead of rendering as undefined.
   `learning` and `leads` are the two sections the dashboard route adds on top
   of it — optional on both sides, so a route that has not shipped them yet
   simply renders nothing rather than a zero it invented. */
export type AnalyticsResponse = AnalyticsPayload & {
  learning?: LearningSummary;
  leads?: LeadsSummary;
};

export type DateRange = {
  from: string;
  to: string;
};

export type FunnelMode = "payment" | "access";

export type FunnelUiSettings = {
  mode: FunnelMode;
  showAccessGrantedCard: boolean;
};
