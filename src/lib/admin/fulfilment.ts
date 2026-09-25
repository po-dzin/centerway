/**
 * THE STATE OF A PURCHASE THAT A PERSON CARRIES OUT (2026-09-20).
 *
 * A course is delivered the moment it is paid for; a consultation, a guided
 * package and a parcel of herbs are delivered by somebody, later. Until now the
 * only record of that second half was a Telegram thread. `orders.fulfilment_status`
 * holds it: the database sets `pending` when such an order is written
 * (`orders_link_offer`), and the operator moves it from here.
 *
 * On the ORDER, not on the right of access, because a service is consumed: two
 * consultations are two purchases, each with its own state, and a seat on a
 * course is one lasting right.
 *
 * ANY STEP TO ANY STEP. A consultation that was scheduled and then cancelled,
 * or marked done by mistake, is corrected by setting it again; a state machine
 * that refused the correction would leave the operator editing the database.
 * What IS refused is giving a state to an order that has none — a course sale —
 * because there is nothing there for a person to carry out.
 */

import type { Db } from "./access/shared";
import { AccessError, writeAudit } from "./access/shared";
import { isFulfilmentStatus, type FulfilmentStatus } from "./fulfilmentStatus";

export { FULFILMENT_STATUSES, isFulfilmentStatus, type FulfilmentStatus } from "./fulfilmentStatus";

export async function setFulfilmentStatus(
  db: Db,
  input: { orderRef: string; status: FulfilmentStatus; actorId: string; note?: string | null },
): Promise<{ orderRef: string; status: FulfilmentStatus; previous: FulfilmentStatus }> {
  const { data: order, error } = await db
    .from("orders")
    .select("order_ref, fulfilment_status")
    .eq("order_ref", input.orderRef)
    .maybeSingle();
  if (error) throw new AccessError(error.message, 500);
  if (!order) throw new AccessError("order_not_found", 404);

  const previous = order.fulfilment_status as string | null;
  if (!isFulfilmentStatus(previous)) throw new AccessError("order_not_fulfilled_by_hand", 409);
  if (previous === input.status) return { orderRef: input.orderRef, status: input.status, previous };

  const { error: updateError } = await db
    .from("orders")
    .update({ fulfilment_status: input.status })
    .eq("order_ref", input.orderRef);
  if (updateError) throw new AccessError(updateError.message, 500);

  await writeAudit(db, {
    actorId: input.actorId,
    action: "order.fulfilment.set",
    entityType: "order",
    entityId: input.orderRef,
    metadata: { previous, next: input.status, note: input.note?.trim() || null },
  });

  return { orderRef: input.orderRef, status: input.status, previous };
}
