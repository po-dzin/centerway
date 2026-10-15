/**
 * Whether a paid order should be offered the one-tap Telegram link, and the
 * link itself (`lib/platform/orderTelegramLink.ts`).
 *
 * Two readers: the page the buyer returns to, and the receipt. They differ in
 * how much they trust the request. The receipt goes to the buyer's own address,
 * so it always carries the link. The page is reached by a URL whose order
 * reference anyone could retype, so it offers the link only in the first day
 * after the order — the moment it is for — and only while no chat is linked:
 * a buyer who already gets reminders has nothing to tap.
 */

import { adminClient } from "@/lib/auth/adminClient";
import { orderTelegramUrl } from "@/lib/platform/orderTelegramLink";

/** How long after the order the return page still offers the link. */
export const RETURN_LINK_WINDOW_MS = 24 * 60 * 60 * 1000;

type OrderForLink = {
  id: string;
  status: string;
  created_at: string;
  customer_id: string | null;
};

/** Pure: may this order, read from the return page, be handed the link? */
export function returnPageMayOfferLink(
  order: OrderForLink | null,
  customerHasChat: boolean,
  now = Date.now(),
): order is OrderForLink {
  if (!order || order.status !== "paid" || !order.customer_id || customerHasChat) return false;
  const created = Date.parse(order.created_at);
  return Number.isFinite(created) && now - created <= RETURN_LINK_WINDOW_MS;
}

async function readOrder(orderRef: string): Promise<{ order: OrderForLink | null; customerHasChat: boolean }> {
  const db = adminClient();
  const { data: order } = await db
    .from("orders")
    .select("id, status, created_at, customer_id")
    .eq("order_ref", orderRef)
    .maybeSingle();
  if (!order?.customer_id) return { order: order ?? null, customerHasChat: false };
  const { data: customer } = await db.from("customers").select("tg_id").eq("id", order.customer_id).maybeSingle();
  return { order, customerHasChat: Boolean(customer?.tg_id) };
}

/** For the return page. Null whenever the link should not be shown; never throws. */
export async function returnPageTelegramUrl(orderRef: string, now = Date.now()): Promise<string | null> {
  try {
    const { order, customerHasChat } = await readOrder(orderRef);
    return returnPageMayOfferLink(order, customerHasChat, now) ? orderTelegramUrl(order.id, now) : null;
  } catch {
    return null;
  }
}

/** For the receipt: every paid order with a buyer and no chat yet. Never throws. */
export async function receiptTelegramUrl(orderRef: string, now = Date.now()): Promise<string | null> {
  try {
    const { order, customerHasChat } = await readOrder(orderRef);
    if (!order?.customer_id || customerHasChat) return null;
    return orderTelegramUrl(order.id, now);
  } catch {
    return null;
  }
}
