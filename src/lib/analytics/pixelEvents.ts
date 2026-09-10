/**
 * ONE CLASSIFICATION OF A PIXEL EVENT NAME.
 *
 * The admin dashboard and the Meta Ads sync each had their own until
 * 2026-09-11, and they disagreed: the dashboard's matched any name that
 * CONTAINED "view_content" or "initiate_checkout", the sync's only the exact
 * names and the `fb_pixel_` prefix. Every event the landings and the platform
 * send is a standard name — ViewContent, InitiateCheckout, Purchase, Lead,
 * PageView — so the two agreed on everything that exists, and the loose one
 * only added the risk of a substring match. The strict one stays, for both.
 */

export function normalizePixelEventNameStrict(raw: string): "view_content" | "initiate_checkout" | "purchase" | null {
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  if (value === "viewcontent" || value === "view_content" || value.includes("fb_pixel_view_content")) {
    return "view_content";
  }
  if (value === "initiatecheckout" || value === "initiate_checkout" || value.includes("fb_pixel_initiate_checkout")) {
    return "initiate_checkout";
  }
  if (value === "purchase" || value.includes("fb_pixel_purchase")) {
    return "purchase";
  }
  return null;
}
