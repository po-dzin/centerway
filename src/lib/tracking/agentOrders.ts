import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * How an order remembers that an agent started it — the `via_agent` mark.
 *
 * One `events` row per order, the same bridge `staffOrders` uses and for the
 * same reason: nothing about the payment schema has to change to carry a
 * tracking concern. Unlike staff, the order stays a real sale: a person still
 * pays, so the money counts and the webhook's Purchase still goes to Meta.
 * Only the agent's own steps (InitiateCheckout, the Pixel) are kept out.
 */
export const AGENT_CHECKOUT_EVENT = "agent_checkout";

/** Best-effort: a failed mark costs a label, never the order. */
export async function markAgentOrder(
  sb: SupabaseClient,
  orderRef: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    const { error } = await sb.from("events").insert({ type: AGENT_CHECKOUT_EVENT, order_ref: orderRef, payload });
    if (error) console.warn("agent_checkout_mark_failed", error.message, { order_ref: orderRef });
  } catch (err) {
    console.warn("agent_checkout_mark_failed", err, { order_ref: orderRef });
  }
}
