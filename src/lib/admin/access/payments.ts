/**
 * Money recorded by hand: a manual payment, and the one-form provisioning that combines account, payment, access and term.
 *
 * Split out of src/lib/admin/access.ts (1,680 lines, five aggregates) on
 * 2026-09-10. The barrel there re-exports this module; import from either.
 */

import { adminClient } from "@/lib/auth/adminClient";
import { sendPurchaseEmail } from "@/lib/email/purchaseEmail";
import { closeWonLeadsForPurchase } from "@/lib/platform/leadStage";
import { accessRuleOf, accessWindowEnd, courseOfferCode } from "@/lms-core";
import type { GrantSource } from "@/lib/admin/accessTypes";
import type { PaymentCurrency } from "@/lib/admin/accessTypes";
import { createAccount, resolveAccountByEmail } from "./accounts";
import { assertGrantable, grantCourse } from "./enrollments";
import { AccessError, type Db, writeAudit } from "./shared";

/**
 * Records money that arrived outside the payment provider.
 *
 * A bank transfer, cash, a partner's invoice — the sale is real, but WayForPay
 * never saw it, so no `orders` row exists and the buyer owns nothing: the LMS,
 * the profile and every revenue report read paid orders, not enrollments.
 * Writing the order is what makes a hand-made sale indistinguishable from an
 * automatic one everywhere downstream.
 *
 * The reference is prefixed `manual_` on purpose. It has to be obvious at a
 * glance — in a report, in the orders table, in the audit log — that a human
 * asserted this payment rather than a provider confirming it.
 */
export async function recordManualPayment(input: {
  email: string;
  productCode: string;
  amount: number;
  currency: PaymentCurrency;
  note?: string | null;
  actorId: string;
  /** Set when the buyer already has an account, so the purchase is theirs immediately. */
  authUserId?: string | null;
}) {
  const db = adminClient();
  const email = input.email.trim().toLowerCase();
  if (!email) throw new AccessError("email_required");

  const productCode = input.productCode.trim();
  if (!productCode) throw new AccessError("product_code_required");
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new AccessError("amount_invalid");

  const customerId = await resolveCustomerId(db, email, input.authUserId ?? null);

  const orderRef = manualOrderRef(productCode);
  const paidAt = new Date().toISOString();

  const { error } = await db.from("orders").insert({
    order_ref: orderRef,
    product_code: productCode,
    amount: input.amount,
    currency: input.currency,
    status: "paid",
    customer_id: customerId,
    created_at: paidAt,
  });
  if (error) throw new AccessError(error.message, 500);

  /* THE CONCIERGE CASE, which is the one this product actually runs on: a
     request came in, the founder answered it, talked to the person and sold
     them something — often something other than the thing the form named.
     `all_open` rather than `same_product` for exactly that reason: whoever
     pressed this button knows the conversation ended, and the gateway never
     does. Best-effort — the sale is already recorded and must stand whatever
     happens to a stage. */
  try {
    await closeWonLeadsForPurchase(db, { email, productCode, scope: "all_open" });
  } catch {
    // a recorded sale is never undone by a lead stage
  }

  await writeAudit(db, {
    actorId: input.actorId,
    action: "order.manual.record",
    entityType: "order",
    entityId: orderRef,
    metadata: {
      email,
      product_code: productCode,
      amount: input.amount,
      currency: input.currency,
      customer_id: customerId,
      note: input.note?.trim() || null,
    },
  });

  return { orderRef, customerId, amount: input.amount, currency: input.currency, productCode, paidAt };
}

/**
 * When a seat sold by hand should close, according to the offer.
 *
 * Anchored at the payment, exactly as `planAccess` anchors a checkout purchase,
 * so the same course sold at the till and sold in admin ends on the same day.
 * A course with no offer row, or one sold for good, has no end — the same
 * "unconfigured means perpetual" direction the door already takes.
 */
async function offerExpiryFor(db: Db, courseSlug: string, paidAt: string): Promise<string | null> {
  const { data: course } = await db.from("lms_courses").select("id").eq("slug", courseSlug).maybeSingle();
  if (!course?.id) return null;

  const { data: offer } = await db
    .from("lms_course_offers")
    .select("access_days, access_lifetime")
    .eq("course_id", course.id)
    .maybeSingle();
  if (!offer) return null;

  const rule = accessRuleOf({
    accessDays: (offer.access_days as number | null) ?? null,
    accessLifetime: (offer.access_lifetime as boolean | null) ?? null,
  });
  if (!rule || rule.lifetime) return null;

  const from = new Date(paidAt);
  if (!Number.isFinite(from.getTime())) return null;
  return accessWindowEnd(from, rule);
}

/**
 * The customer row a manual payment hangs on, created if this email has none.
 *
 * Linking `auth_user_id` here is what lets the LMS find the purchase: entitlement
 * looks up customers by account first and by verified email second, so an
 * unlinked row would leave the buyer staring at a locked course they paid for.
 */
async function resolveCustomerId(db: Db, email: string, authUserId: string | null): Promise<string> {
  const { data: existing, error: readError } = await db
    .from("customers")
    .select("id, auth_user_id")
    .ilike("email", email)
    .order("created_at", { ascending: true })
    .limit(1);
  if (readError) throw new AccessError(readError.message, 500);

  const found = existing?.[0];
  if (found) {
    // Never re-point a row that already belongs to another account — that is
    // a support case, not an automatic merge (see `linkPurchasesToAccount`).
    if (authUserId && !found.auth_user_id) {
      await db.from("customers").update({ auth_user_id: authUserId }).eq("id", found.id).is("auth_user_id", null);
    }
    return found.id as string;
  }

  const { data: inserted, error } = await db
    .from("customers")
    .insert({ email, auth_user_id: authUserId })
    .select("id")
    .single();
  if (error) throw new AccessError(error.message, 500);

  return inserted.id as string;
}

function manualOrderRef(productCode: string): string {
  const token = productCode.replace(/[^a-z0-9-]+/gi, "-");
  const now = new Date();
  const stamp = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
  ].join("");
  const rand = Math.random().toString(16).slice(2, 10);
  return `manual_${token}_${stamp}_${rand}`;
}

export type ProvisionAccessInput = {
  email: string;
  fullName?: string | null;
  courseSlug: string;
  /** ISO instant or `null`; the route normalizes what the operator typed. */
  expiresAt?: string | null;
  /** Create the platform account when this email has never signed in. */
  createAccount?: boolean;
  /** Amount that arrived outside the provider. Omitted for a plain gift or a review grant. */
  payment?: { amount: number; currency: PaymentCurrency; note?: string | null } | null;
  /** Why this seat exists — `manual` unless the operator says bonus or promo. */
  source?: GrantSource;
  actorId: string;
};

/**
 * The whole hand-made sale in one act: person, money, access, deadline.
 *
 * Composed here rather than in the route so the ORDER is stated once and holds:
 * the account must exist before the payment, so the customer row can be linked
 * to it; the grant is checked for the failures it can predict before the
 * payment is written, so a rejected grant never leaves a naked charge; the
 * payment must be written before the grant runs, so the enrollment is backed
 * by a real order rather than only by an operator's word.
 *
 * Each step is independently useful and independently audited — this only fixes
 * the sequence, it does not hide the steps.
 *
 * AND THEN IT TELLS THE BUYER. Until 2026-09-02 it did not: a hand-made sale
 * wrote the order, made the account and opened the course, and sent nothing at
 * all. The person had a working account they had never been told about, at an
 * address only the operator knew, and `createAccount`'s own note promised them
 * "a magic link to this address" that the platform could not send. The receipt
 * goes out at the END, after the grant, because it says the course is ready and
 * that is not true a moment earlier.
 */
export async function provisionAccess(input: ProvisionAccessInput) {
  const db = adminClient();
  const account = input.createAccount
    ? await createAccount({ email: input.email, fullName: input.fullName, actorId: input.actorId })
    : { created: false, account: await resolveAccountByEmail(db, input.email) };

  await assertGrantable(db, input.courseSlug, account.account.authUserId);

  const payment = input.payment
    ? await recordManualPayment({
        email: input.email,
        productCode: courseOfferCode(input.courseSlug),
        amount: input.payment.amount,
        currency: input.payment.currency,
        note: input.payment.note,
        authUserId: account.account.authUserId,
        actorId: input.actorId,
      })
    : null;

  /* The term comes from the offer unless the operator overrode it.
       A hand-recorded sale used to ignore `access_days` entirely: selling a
       30-day course by hand granted it forever unless somebody remembered to
       type a date. The offer is where the term is agreed, so a sale made in
       admin is sold on the same terms as one made at the checkout. */
  const expiresAt =
    input.expiresAt !== undefined
      ? input.expiresAt
      : payment
        ? await offerExpiryFor(db, input.courseSlug, payment.paidAt)
        : null;

  const grant = await grantCourse({
    email: input.email,
    courseSlug: input.courseSlug,
    expiresAt,
    // A hand-recorded sale is a purchase in every way that matters, so it
    // is not filed as a gift: the money is real and the order exists.
    source: input.source ?? (payment ? "manual" : undefined),
    actorId: input.actorId,
    orderRef: payment?.orderRef ?? null,
  });

  /* ONLY FOR A SALE. A grant with no payment is a gift or a promo seat, and
       posting "Оплату отримано" with an order number to somebody who paid
       nothing would be a stranger message than silence. That case still has no
       notification of its own; it wants different words, not this one's. */
  const receipt = payment
    ? await sendManualSaleReceipt(db, {
        email: input.email,
        courseSlug: input.courseSlug,
        amount: payment.amount,
        currency: payment.currency,
        orderRef: payment.orderRef,
      })
    : null;

  return { accountCreated: account.created, account: grant.account, payment, grant, receipt };
}

/**
 * The same receipt a WayForPay buyer gets, for a sale made by hand.
 *
 * Deliberately the same builder rather than a manual-sale variant. The
 * paragraph naming the address the purchase is tied to is the load-bearing part
 * of that message (see `lib/email/purchaseEmail.ts`), and it matters MORE here:
 * the operator typed that address, so the buyer has not yet seen it written
 * down anywhere. Two templates would drift, and the one that drifted would be
 * this one, because it is sent a hundred times less often.
 *
 * Never throws. `sendPurchaseEmail` already swallows its own failures, and a
 * sale that is recorded, granted and audited must not be reported as failed
 * because a mail provider was slow — the operator can resend, and the caller
 * gets the outcome back to say so.
 */
async function sendManualSaleReceipt(
  db: Db,
  input: { email: string; courseSlug: string; amount: number; currency: PaymentCurrency; orderRef: string },
) {
  /* THE COURSE ROW, not `loadPayableOffer`. The offer loader is the right
       answer at the checkout, where the product code is all anyone has — but it
       reads through `unstable_cache`, so it only works inside a request, and it
       returns null for a course that is unlisted or priced at zero. Both of
       those are ordinary states for something sold by hand, and the first would
       make this whole function unusable from anywhere but a route handler.
       Here the slug is already known, so the title comes from the row and the
       link goes straight to the course. */
  const { data: course } = await db.from("lms_courses").select("title").eq("slug", input.courseSlug).maybeSingle();

  const title = typeof course?.title === "string" && course.title.trim() ? course.title.trim() : null;

  return sendPurchaseEmail({
    email: input.email,
    productTitle: title ?? "Ваше замовлення",
    amount: input.amount,
    currency: input.currency,
    fulfilment: { kind: "course", courseSlug: input.courseSlug },
    orderRef: input.orderRef,
  });
}
