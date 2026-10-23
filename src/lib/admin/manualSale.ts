/**
 * «Додати продаж»: a product sold outside the site, written to the person card.
 *
 * G 23.10: herbs today, oils and spices soon, sold by hand, at a fair, in a
 * message thread. A course sold by hand already has its door (the grant
 * dialog in «Доступи», `provisionAccess`); a product had none, so the buyer
 * stayed a stranger to the platform. This is the same act for a thing with no
 * course behind it: find or make the person, write a paid order, audit it.
 *
 * The product is either one the registry knows (`sellableProduct`: the set
 * «Ціни» prices, never a course, so no access opens by accident) or a free
 * title under the code `offline` for what is not registered yet.
 *
 * The person may have only a phone, as offline buyers often do; the card is
 * matched by email or phone (`upsertCustomerByContact`) like every other door.
 * The reference is prefixed `manual_` exactly as a hand-made course sale is.
 */

import { adminClient } from "@/lib/auth/adminClient";
import { closeWonLeadsForPurchase } from "@/lib/platform/leadStage";
import { upsertCustomerByContact } from "@/lib/platform/customerIdentity";
import type { PaymentCurrency } from "@/lib/admin/accessTypes";
import { AccessError, type Db, writeAudit } from "@/lib/admin/access/shared";
import { sellableProduct } from "@/lib/admin/productOffers";

/** The code an order carries when the thing sold is not in the registry. */
export const OFFLINE_PRODUCT_CODE = "offline";

export type ProductSaleInput = {
  /** The card the sale belongs to; when absent, `person` finds or makes one. */
  customerId?: string | null;
  person?: { name?: string | null; email?: string | null; phone?: string | null } | null;
  /** A registered product's code, or absent with `otherTitle` for one that is not. */
  productCode?: string | null;
  otherTitle?: string | null;
  amount: number;
  currency: PaymentCurrency;
  /** `YYYY-MM-DD` the money came in; absent is today. */
  paidOn?: string | null;
  note?: string | null;
  actorId: string;
};

function paidAtOf(paidOn: string | null | undefined, now: Date): string {
  if (!paidOn) return now.toISOString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidOn) || !Number.isFinite(Date.parse(`${paidOn}T12:00:00.000Z`))) {
    throw new AccessError("paid_on_invalid");
  }
  const at = new Date(`${paidOn}T12:00:00.000Z`);
  if (at.getTime() > now.getTime() + 24 * 3600 * 1000) throw new AccessError("paid_on_future");
  return at.toISOString();
}

function orderRefFor(code: string, now: Date): string {
  const stamp = now.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.random().toString(16).slice(2, 10);
  return `manual_${code.replace(/[^a-z0-9-]+/gi, "-")}_${stamp}_${rand}`;
}

async function cardFor(db: Db, input: ProductSaleInput, now: Date): Promise<{ id: string; email: string | null }> {
  if (input.customerId) {
    const { data, error } = await db.from("customers").select("id, email").eq("id", input.customerId).maybeSingle();
    if (error) throw new AccessError(error.message, 500);
    if (!data) throw new AccessError("customer_not_found", 404);
    return { id: data.id as string, email: (data.email as string | null) ?? null };
  }

  const name = input.person?.name?.trim() || null;
  const found = await upsertCustomerByContact(db, { email: input.person?.email, phone: input.person?.phone });
  if (!found.id) throw new AccessError("contact_required");

  const { data, error } = await db.from("customers").select("id, email, display_name").eq("id", found.id).single();
  if (error) throw new AccessError(error.message, 500);
  /* A card this sale made learns where it came from; one that already
     existed keeps its own first touch and only gains a name it lacked. */
  const patch: { display_name?: string; first_touch?: { channel: string; medium: string; at: string } } = {};
  if (name && !data.display_name) patch.display_name = name;
  if (found.created) patch.first_touch = { channel: "offline", medium: "manual", at: now.toISOString() };
  if (Object.keys(patch).length > 0) {
    const { error: patchError } = await db.from("customers").update(patch).eq("id", found.id);
    if (patchError) throw new AccessError(patchError.message, 500);
  }
  return { id: found.id, email: (data.email as string | null) ?? null };
}

export async function recordProductSale(input: ProductSaleInput, now: Date = new Date()) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new AccessError("amount_invalid");
  const paidAt = paidAtOf(input.paidOn, now);

  const code = input.productCode?.trim() || null;
  const otherTitle = input.otherTitle?.trim() || null;
  if (!code && !otherTitle) throw new AccessError("product_required");
  // Checked before the card is touched: an unknown code refuses the sale whole.
  const product = code ? await sellableProduct(code) : null;
  if (code && !product) throw new AccessError("product_unknown", 404);

  const db = adminClient();
  const card = await cardFor(db, input, now);
  const productCode = product?.code ?? OFFLINE_PRODUCT_CODE;
  const title = product?.title ?? otherTitle;
  const orderRef = orderRefFor(productCode, now);
  const note = input.note?.trim() || null;

  const { error } = await db.from("orders").insert({
    order_ref: orderRef,
    product_code: productCode,
    experience_id: product?.id ?? null,
    amount: input.amount,
    currency: input.currency,
    status: "paid",
    customer_id: card.id,
    created_at: paidAt,
    meta: { manual: true, title, note },
  });
  if (error) throw new AccessError(error.message, 500);

  if (card.email) {
    try {
      await closeWonLeadsForPurchase(db, { email: card.email, productCode, scope: "all_open" });
    } catch {
      // a recorded sale is never undone by a lead stage
    }
  }

  await writeAudit(db, {
    actorId: input.actorId,
    action: "order.manual.product",
    entityType: "order",
    entityId: orderRef,
    metadata: {
      customer_id: card.id,
      product_code: productCode,
      title,
      amount: input.amount,
      currency: input.currency,
      paid_at: paidAt,
      note,
    },
  });

  return { orderRef, customerId: card.id, productCode, title, amount: input.amount, currency: input.currency, paidAt };
}
