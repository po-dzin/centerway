import Link from "next/link";

import { PlatformShell } from "@/components/platform/PlatformLayout";
import { PurchaseSignal } from "@/components/platform/PurchaseSignal";
import { PayPendingWatcher } from "@/components/platform/PayPendingWatcher";
import offerStyles from "@/components/platform/PlatformOfferStyles";
import styles from "@/components/platform/PlatformOfferCommerce.module.css";
import { SUPPORT_BOT_URL } from "@/lib/tgSupportBotCopy";
import { PROFILE_PATH_PREFIX, surfaceUrl } from "@/lib/surfaces/catalog";
import { loadPayableOffer } from "@/lib/platform/offers";
import type { ReturnStatus } from "@/lib/payReturn";
import {
  formatPrice,
  type ProductFulfilment,
  type SearchParams,
} from "@/lib/products";

/**
 * One confirmation page for every product, on the platform's own design system.
 *
 * It replaces five static ones. That was not five copies of a page — it was
 * five copies of a CONTRACT: pixel init, a Purchase with the right event id, a
 * client signal to /api/events, an order line, and a destination. Each landing
 * held its own version, on its own skin, with its own hard-coded redirect, and
 * they had already drifted: three redirected to the platform, two to a bot, and
 * the `contentByProduct` table listing the product names was different in all
 * five files.
 *
 * What deliberately did NOT survive the move: the automatic redirect. The old
 * pages waited for the pixel and then threw the buyer somewhere. Here the
 * destination is a button, because a person who has just paid is entitled to
 * read the confirmation before the page moves.
 *
 * The static pages stay where they are. WayForPay stores the return URL WITH
 * the invoice, so a payment started before this shipped still comes back to the
 * old address — deleting them would 404 exactly the people who paid last.
 */

function firstParam(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function parseAmount(raw: string | null): number | null {
  if (!raw) return null;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export async function PayStatusPage({
  status,
  searchParams,
}: {
  status: ReturnStatus;
  searchParams: SearchParams;
}) {
  /* NO LONGER DEFAULTS TO "short". It used to, so that the page rendered
     something when the provider dropped the field — but the same default sent
     a buyer of anything unrecognised to Short Reboot's Telegram bot. An unknown
     product now falls back to the CABINET, which is true for every purchase:
     whatever it was, it is in the buyer's account. */
  const offer = await loadPayableOffer(firstParam(searchParams.product));
  const orderRef = firstParam(searchParams.order_ref) ?? firstParam(searchParams.orderReference);
  const transactionId = firstParam(searchParams.payment_id) ?? firstParam(searchParams.rrn);
  const amount = parseAmount(firstParam(searchParams.amount));
  const currency = (firstParam(searchParams.currency) ?? offer?.currency ?? "UAH").toUpperCase();

  const paid = status === "paid";
  const pending = status === "pending";
  const fulfilment: ProductFulfilment = offer?.fulfilment ?? { kind: "cabinet" };
  const contentName = offer?.pixelContentName ?? "CenterWay";
  const product: string = offer?.code ?? firstParam(searchParams.product) ?? "";

  /* A DECLINE IS THE MOST RECOVERABLE MOMENT IN THE FUNNEL, and until now it
     ended at a catalogue. The product is already resolved on this page, so the
     way back to the same checkout is one link — a buyer whose bank refused the
     first card is trying again, not shopping. */
  const retryHref = offer?.code ? `/api/pay/start?product=${encodeURIComponent(offer.code)}&cta_place=pay_failed_retry` : null;

  const destination = paid
    ? fulfilment.kind === "bot"
      ? { href: fulfilment.url, label: "Відкрити бот", external: true }
      : fulfilment.kind === "course"
        ? // ABSOLUTE, because this page cannot move. `PLATFORM_THANKS_URL` is
          // baked into invoices WayForPay has already issued, so the return
          // always lands on `www` while the course now lives on `my`. This link
          // is the hand-off between the two.
          { href: surfaceUrl(`/learn/${fulfilment.courseSlug}`), label: "Перейти до курсу", external: false }
        : /* ABSOLUTE for the same reason the course link above is: this page
             always answers on `www` (its URL is baked into invoices WayForPay
             has already issued) and the cabinet moved to `my`. Naming the
             owner skips the 308. */
          { href: surfaceUrl(PROFILE_PATH_PREFIX), label: "Перейти в кабінет", external: false }
    : pending
      ? { href: "/programs", label: "Повернутися до програм", external: false }
      : retryHref
        ? { href: retryHref, label: "Спробувати ще раз", external: false }
        : { href: "/programs", label: "Повернутися до програм", external: false };

  const lead = paid
    ? fulfilment.kind === "bot"
      ? "Доступ уже готується. Відкрийте бот — саме там уроки і подальші інструкції."
      : fulfilment.kind === "course"
        ? "Курс уже ваш. Він відкритий у кабінеті — там усі матеріали і прогрес."
        : "Замовлення прийнято, і воно вже видно у вашому кабінеті. Деталі складу і доставки уточнимо в Telegram."
    : pending
      ? /* NOT "гроші не списані". We do not know that yet, and this is the
           sentence the old page said to people whose card HAD been charged —
           whose likely next act was to pay a second time. */
        "Банк ще підтверджує оплату — зазвичай це триває до хвилини. Сторінка оновиться сама, щойно надійде відповідь. Не закривайте її і не платіть удруге."
      : "Оплата не пройшла, і гроші не списані. Найчастіше це ліміт картки або відмова банку — спробуйте ще раз або напишіть нам, розберемось разом.";

  const meta = [
    transactionId || orderRef ? `Номер платежу: ${transactionId || orderRef}` : null,
    amount ? formatPrice(amount, currency) : null,
    contentName,
  ].filter(Boolean) as string[];

  return (
    /* `default`, not `overlay`. Overlay is for a page that opens on a dark hero
       photograph and lets the bar float over it; this page opens on the canvas,
       and the overlay bar came out light-on-light — the navigation was there and
       could not be read. */
    <PlatformShell headerMode="default">
      <main data-cw-platform-template={paid ? "pay-thanks" : pending ? "pay-pending" : "pay-failed"}>
        {/* Only on a confirmed payment. A Purchase fired while we are still
            asking the gateway would report a sale that may not have happened. */}
        {paid ? (
          <PurchaseSignal
            orderRef={orderRef}
            product={product}
            contentName={contentName}
            transactionId={transactionId}
            value={amount}
            currency={currency}
          />
        ) : null}

        <section
          className={`${offerStyles.container} ${offerStyles.section}`}
          data-cw-semantic-role="support"
          data-cw-semantic-family="support-boundary"
          data-cw-token-source="global-app-ds"
        >
          <article className={`${offerStyles.panel} ${styles.statusPanel}`}>
            <p className={offerStyles.label}>
              {paid ? "Підтвердження оплати" : pending ? "Перевіряємо оплату" : "Оплата не пройшла"}
            </p>
            <h1 className={offerStyles.title}>
              {paid ? "Дякуємо! Оплату прийнято" : pending ? "Чекаємо підтвердження банку" : "Платіж не завершився"}
            </h1>
            <p className={offerStyles.lead}>{lead}</p>

            {pending && orderRef ? (
              <PayPendingWatcher orderRef={orderRef} product={product || null} />
            ) : null}

            <div className={styles.statusActions}>
              {/* NO PRIMARY ACTION WHILE WAITING. The sentence above asks the
                  buyer not to close the page; offering them the catalogue in
                  the loudest button on it would be telling them to leave. The
                  page's whole job here is to wait, and it moves on by itself. */}
              {pending ? null : destination.external ? (
                <a
                  className={styles.statusPrimaryAction}
                  href={destination.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {destination.label}
                </a>
              ) : (
                <Link className={styles.statusPrimaryAction} href={destination.href}>
                  {destination.label}
                </Link>
              )}
              <a
                className={styles.statusSecondaryAction}
                href={SUPPORT_BOT_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Написати в підтримку
              </a>
            </div>

            <ul className={styles.statusMeta}>
              {paid && fulfilment.kind !== "bot" ? (
                /* Load-bearing, not politeness: access is matched by the email
                   used at checkout, so signing in with another address finds no
                   purchase and reads as "I paid and got nothing". */
                <li>
                  <strong>Важливо:</strong> входьте тим самим email, який вказали під час оплати — за ним
                  відкривається доступ.
                </li>
              ) : null}
              {meta.length > 0 ? <li>{meta.join(" · ")}</li> : null}
            </ul>
          </article>
        </section>
      </main>
    </PlatformShell>
  );
}
