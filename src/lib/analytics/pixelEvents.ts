/**
 * TWO CLASSIFICATIONS OF THE SAME PIXEL EVENT NAME — deliberately kept apart.
 *
 * The admin dashboard and the Meta Ads sync each had a private
 * `normalizePixelEventName`, and they disagree: the dashboard's matches any
 * name that CONTAINS "view_content" or "initiate_checkout", the sync's only the
 * exact names and the `fb_pixel_` prefix. Merging them would silently move
 * numbers in whichever surface lost. They live here under honest names until
 * the owner decides which reading is right; each caller keeps the one it had.
 */

export function normalizePixelEventNameLoose(raw: string): "view_content" | "initiate_checkout" | "purchase" | null {
    const value = raw.trim().toLowerCase();
    if (!value) return null;
    if (
        value === "viewcontent" ||
        value === "view_content" ||
        value.includes("fb_pixel_view_content") ||
        value.includes("view_content")
    ) {
        return "view_content";
    }
    if (
        value === "initiatecheckout" ||
        value === "initiate_checkout" ||
        value.includes("fb_pixel_initiate_checkout") ||
        value.includes("initiated_checkout") ||
        value.includes("initiate_checkout")
    ) {
        return "initiate_checkout";
    }
    if (value === "purchase" || value.includes("fb_pixel_purchase")) {
        return "purchase";
    }
    return null;
}

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
