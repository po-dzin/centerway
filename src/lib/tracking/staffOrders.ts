import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * How an order remembers that it came from staff.
 *
 * `cw_staff=1` is a browser flag: it silences the Pixel and the InitiateCheckout
 * job at the moment of the click. But the sale is confirmed later by a WayForPay
 * webhook, which has no browser and no cookie — so every QA payment used to come
 * back as a genuine Purchase in Meta, which is precisely the conversion the flag
 * exists to suppress.
 *
 * The bridge is one row: `/api/pay/start` writes a `staff_checkout` event for the
 * order, and the webhook asks for it before enqueuing anything to Meta. It lives
 * in `events` rather than a column on `orders` so that nothing about the payment
 * schema has to change to carry a testing concern.
 */
export const STAFF_CHECKOUT_EVENT = "staff_checkout";

/**
 * Fails OPEN on error: a database hiccup must not silently drop a real customer's
 * Purchase. A missed suppression costs one wrong row in Meta; a missed Purchase
 * costs attribution for a real sale.
 */
export async function isStaffOrder(
  sb: SupabaseClient,
  orderRef: string
): Promise<boolean> {
  try {
    const { data, error } = await sb
      .from("events")
      .select("id")
      .eq("order_ref", orderRef)
      .eq("type", STAFF_CHECKOUT_EVENT)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.warn("[staffOrders] lookup failed, treating order as real:", error.message);
      return false;
    }
    return Boolean(data?.id);
  } catch (err) {
    console.warn("[staffOrders] lookup threw, treating order as real:", err);
    return false;
  }
}
