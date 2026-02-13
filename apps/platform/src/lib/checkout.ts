import { ProductCode, normalizeProduct } from "@/lib/products";

export type CheckoutStartRequest = {
  site?: unknown;
  offer_id?: unknown;
  event_id?: unknown;
  email?: unknown;
  phone?: unknown;
  value?: unknown;
  currency?: unknown;
  product?: unknown;
  product_code?: unknown;
  utm_source?: unknown;
  utm_medium?: unknown;
  utm_campaign?: unknown;
  utm_content?: unknown;
  utm_term?: unknown;
  fbclid?: unknown;
  cr?: unknown;
  lv?: unknown;
  referrer?: unknown;
  page_url?: unknown;
  user_agent?: unknown;
};

function asCleanString(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s : null;
}

export function resolveCheckoutProduct(body: CheckoutStartRequest): ProductCode {
  const byProductField = normalizeProduct({
    product: asCleanString(body.product) ?? undefined,
    product_code: asCleanString(body.product_code) ?? undefined,
  });
  if (byProductField === "short" || byProductField === "irem") return byProductField;

  const site = asCleanString(body.site)?.toLowerCase();
  if (site === "irem") return "irem";
  if (site === "short") return "short";

  const offer = asCleanString(body.offer_id)?.toLowerCase() ?? "";
  if (offer.includes("irem")) return "irem";
  if (offer.includes("short") || offer.includes("reboot")) return "short";

  return "short";
}

export function checkoutLeadId(orderRef: string): string {
  return `lead_${orderRef}`;
}

export function buildCheckoutEventPayload(body: CheckoutStartRequest) {
  return {
    site: asCleanString(body.site),
    offer_id: asCleanString(body.offer_id),
    event_id: asCleanString(body.event_id),
    email: asCleanString(body.email),
    phone: asCleanString(body.phone),
    value: typeof body.value === "number" ? body.value : null,
    currency: asCleanString(body.currency),
    utm_source: asCleanString(body.utm_source),
    utm_medium: asCleanString(body.utm_medium),
    utm_campaign: asCleanString(body.utm_campaign),
    utm_content: asCleanString(body.utm_content),
    utm_term: asCleanString(body.utm_term),
    fbclid: asCleanString(body.fbclid),
    cr: asCleanString(body.cr),
    lv: asCleanString(body.lv),
    referrer: asCleanString(body.referrer),
    page_url: asCleanString(body.page_url),
    user_agent: asCleanString(body.user_agent),
  };
}
