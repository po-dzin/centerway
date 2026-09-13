/* Which numbers the ad ledger can show, and which it shows by default.
 *
 * The split matters: the five PRIMARY fields are the ones a person reads to
 * answer "is this working" and are on at first run; the OPTIONAL five are the
 * ones you turn on while investigating. The stored preference is a list of
 * keys from this file, which is why the reader validates against it. */

import type { CapiEventName } from "@/lib/admin/analytics/types";

export type MetricFieldKey =
  "revenue" | "reach" | "impressions" | "frequency" | "clicks" | "spend" | "cpa" | "cpc" | "roas" | "roi";

export type MetricDef = {
  key: MetricFieldKey;
  labelKey: string;
};

export const PRIMARY_METRIC_FIELDS: MetricDef[] = [
  { key: "spend", labelKey: "analytics_metric_spend" },
  { key: "revenue", labelKey: "analytics_metric_revenue" },
  { key: "roas", labelKey: "analytics_metric_roas" },
  { key: "cpa", labelKey: "analytics_metric_cpa" },
  { key: "roi", labelKey: "analytics_metric_roi" },
];

export const OPTIONAL_METRIC_FIELDS: MetricDef[] = [
  { key: "reach", labelKey: "analytics_metric_reach" },
  { key: "impressions", labelKey: "analytics_metric_impressions" },
  { key: "frequency", labelKey: "analytics_metric_frequency" },
  { key: "clicks", labelKey: "analytics_metric_clicks" },
  { key: "cpc", labelKey: "analytics_metric_cpc" },
];

export const METRIC_FIELDS: MetricDef[] = [...PRIMARY_METRIC_FIELDS, ...OPTIONAL_METRIC_FIELDS];

export const METRIC_VISIBILITY_KEY = "cw_analytics_visible_metrics";
export const FUNNEL_UI_SETTINGS_KEY = "cw_analytics_funnel_ui_settings";
export const DASHBOARD_MODE_KEY = "cw_analytics_dashboard_mode";

export function metricEventLabelKey(eventName: CapiEventName): string {
  if (eventName === "ViewContent") return "analytics_event_view_content";
  if (eventName === "InitiateCheckout") return "analytics_event_initiate_checkout";
  return "analytics_event_purchase";
}
