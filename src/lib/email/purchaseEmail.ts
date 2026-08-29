/**
 * The receipt a buyer gets, and — until now — did not.
 *
 * WHY THIS EXISTS. Before 2026-08-29 a completed purchase produced no email at
 * all. Delivery was the `/pay/thanks` page plus a Telegram hand-off, which
 * works for exactly as long as the buyer keeps that tab open. Close it and
 * there was no receipt, no link, and no way back except support — on a funnel
 * that is bought with paid traffic from people who have never seen the brand
 * before.
 *
 * THE PART THAT IS NOT DECORATION. Entitlement is matched by EMAIL: a purchase
 * belongs to the account whose verified address equals the one WayForPay took
 * (`findCustomerIds` in lms/server.ts). A buyer who pays with one address and
 * signs in with their Google account on another gets nothing, silently, and
 * only support can fix it. This message is the only place that tells them
 * which address to use — so the paragraph naming it is load-bearing, not
 * filler, and must not be edited away as boilerplate.
 */

import { adminClient } from "@/lib/auth/adminClient";
import { PROFILE_PATH_PREFIX, surfaceUrl } from "@/lib/surfaces/catalog";
import { SUPPORT_BOT_URL } from "@/lib/tgSupportBotCopy";
import type { ProductFulfilment } from "@/lib/products";
import { sendEmail } from "./resend";

export type PurchaseEmailContent = {
  subject: string;
  html: string;
  text: string;
};

export type PurchaseEmailInput = {
  email: string;
  productTitle: string;
  amount: number | null;
  currency: string;
  fulfilment: ProductFulfilment;
  orderRef: string;
};

/** Where this purchase is collected — the same three answers `/pay/thanks` gives. */
function destination(fulfilment: ProductFulfilment): { href: string; label: string } {
  if (fulfilment.kind === "bot") return { href: fulfilment.url, label: "Відкрити бот" };
  if (fulfilment.kind === "course") {
    // ABSOLUTE. The course lives on the personal host and this link is read in
    // a mail client, which has no origin to be relative to.
    return { href: surfaceUrl(`/learn/${fulfilment.courseSlug}`), label: "Перейти до курсу" };
  }
  return { href: surfaceUrl(PROFILE_PATH_PREFIX), label: "Перейти в кабінет" };
}

function formatAmount(amount: number | null, currency: string): string | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  const rounded = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
  return `${rounded} ${currency.toUpperCase()}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Pure: no network, no database. Kept separate so the wording can be tested
 * without sending anything, and so a change to the copy cannot accidentally
 * change who receives it.
 *
 * Addressed with «ви» — the same register the bot, the reminders and the
 * cabinet already use. Three voices in one funnel is what that convention was
 * adopted to stop.
 */
export function buildPurchaseEmail(input: PurchaseEmailInput): PurchaseEmailContent {
  const { href, label } = destination(input.fulfilment);
  const price = formatAmount(input.amount, input.currency);
  const title = input.productTitle;

  const subject = `Оплату отримано — ${title}`;

  const signInNote =
    input.fulfilment.kind === "bot"
      ? null
      : `Заходьте на платформу через цю саму адресу — ${input.email}. Доступ прив'язаний до неї, і якщо увійти через інший акаунт, купленого курсу там не буде.`;

  const lines = [
    `Дякуємо! Оплату прийнято.`,
    ``,
    `Що придбано: ${title}`,
    price ? `Сума: ${price}` : null,
    `Номер замовлення: ${input.orderRef}`,
    ``,
    `${label}: ${href}`,
    ``,
    signInNote,
    signInNote ? `` : null,
    `Якщо щось не відкривається — напишіть нам: ${SUPPORT_BOT_URL}`,
    ``,
    `CenterWay`,
  ].filter((line): line is string => line !== null);

  const text = lines.join("\n");

  /* Inline styles and a table-free layout on purpose: mail clients strip
     <style> blocks, and this message has one job — carry a link that works. */
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#2b2723;max-width:520px;margin:0 auto;padding:24px">
  <p style="margin:0 0 20px">Дякуємо! Оплату прийнято.</p>
  <p style="margin:0 0 4px"><strong>${escapeHtml(title)}</strong></p>
  ${price ? `<p style="margin:0 0 4px;color:#6b625a">Сума: ${escapeHtml(price)}</p>` : ""}
  <p style="margin:0 0 24px;color:#6b625a">Замовлення: ${escapeHtml(input.orderRef)}</p>
  <p style="margin:0 0 24px">
    <a href="${escapeHtml(href)}" style="display:inline-block;background:#2b2723;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:700">${escapeHtml(label)}</a>
  </p>
  ${signInNote ? `<p style="margin:0 0 20px;color:#6b625a">${escapeHtml(signInNote)}</p>` : ""}
  <p style="margin:0 0 20px;color:#6b625a">Якщо щось не відкривається — <a href="${escapeHtml(SUPPORT_BOT_URL)}" style="color:#2b2723">напишіть нам</a>.</p>
  <p style="margin:0;color:#9a9089">CenterWay</p>
</div>`;

  return { subject, html, text };
}

/**
 * Has this order's receipt already gone out?
 *
 * NOT optional bookkeeping. WayForPay redelivers a service callback for up to
 * four days until it gets a signed acceptance, and even with that acceptance in
 * place a retry can arrive before the first response is processed. Without this
 * gate a single sale mails the buyer once an hour for a day. Same mechanism the
 * Telegram sale report uses, and for the same reason.
 */
async function purchaseEmailSent(orderRef: string): Promise<boolean> {
  const db = adminClient();
  const { data, error } = await db
    .from("events")
    .select("id")
    .eq("type", "purchase_email_sent")
    .eq("order_ref", orderRef)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data?.id);
}

export type SendPurchaseEmailResult = {
  sent: boolean;
  reason?: string;
};

/**
 * Send the receipt for one paid order, at most once.
 *
 * Never throws: the caller is the payment webhook, where the sale is already
 * recorded and an exception here would be a completed purchase reported as a
 * failure.
 */
export async function sendPurchaseEmail(
  input: PurchaseEmailInput
): Promise<SendPurchaseEmailResult> {
  try {
    if (!input.email) return { sent: false, reason: "no_email" };
    if (await purchaseEmailSent(input.orderRef)) return { sent: false, reason: "already_sent" };

    const content = buildPurchaseEmail(input);
    const result = await sendEmail({
      to: input.email,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });

    if (!result.sent) {
      console.warn("[purchase-email] not sent", { orderRef: input.orderRef, reason: result.reason, detail: result.detail });
      return { sent: false, reason: result.reason };
    }

    /* Marked AFTER the provider accepted it. The other order — mark, then send
       — loses the receipt entirely when the send fails, because the gate above
       would report it already delivered. Marking late can at worst repeat the
       message; marking early silently drops it. */
    const db = adminClient();
    const { error } = await db.from("events").insert({
      type: "purchase_email_sent",
      order_ref: input.orderRef,
      payload: { provider: "resend", message_id: result.id, to: input.email },
    });
    if (error) {
      console.warn("[purchase-email] sent but not recorded", { orderRef: input.orderRef, error: error.message });
    }

    return { sent: true };
  } catch (error) {
    console.warn("[purchase-email] failed", {
      orderRef: input.orderRef,
      error: error instanceof Error ? error.message : String(error),
    });
    return { sent: false, reason: "exception" };
  }
}
