export type HostBrand = "short" | "irem";

export type AttributionPayload = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  cr?: string;
  lv?: string;
  referrer?: string;
  page_url?: string;
  user_agent?: string;
};

export type CheckoutStartRequest = {
  site?: string;
  offer_id?: string;
  email?: string;
  phone?: string;
  event_id?: string;
  value?: number;
  currency?: string;
} & AttributionPayload;

export type CheckoutStartResponse = {
  ok: boolean;
  paymentUrl?: string;
  order_ref?: string;
  product?: "short" | "irem";
  lead_id?: string;
  error?: string;
  details?: string;
};
