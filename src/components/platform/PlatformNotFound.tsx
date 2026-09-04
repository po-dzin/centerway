import Link from "next/link";

import offerStyles from "@/components/platform/PlatformOfferStyles";
import styles from "@/components/platform/PlatformOfferCommerce.module.css";

/**
 * What a 404 says, written once for the two places that have to say it.
 *
 * TWO PAGES, ONE PANEL. `(platform)/not-found.tsx` answers a `notFound()` from
 * a route that exists — a course, an author, a program that is gone — and it
 * renders inside the platform shell, so the reader keeps the navigation they
 * arrived with. `global-not-found.tsx` answers an address that matched no
 * route at all, where there is no route group and therefore no root layout to
 * borrow, so it draws its own document. The sentence and the two exits are the
 * same in both, and they are the same because they live here.
 *
 * THE SHAPE IS THE PAYMENT-STATUS PANEL, not a new one. Both are the same act
 * — one statement at a measure with the way onward under it — and that recipe
 * already exists (see "Payment status" in PlatformOfferCommerce.module.css).
 *
 * TWO EXITS, AND THE QUIET ONE IS THE CATALOGUE. Not support: a wrong address
 * is not a problem the reader needs help with, so the loudest thing on offer
 * is the way back in rather than a conversation.
 */
export function PlatformNotFoundPanel() {
  return (
    <section
      className={`${offerStyles.container} ${offerStyles.section}`}
      data-cw-semantic-role="support"
      data-cw-semantic-family="support-boundary"
      data-cw-token-source="global-app-ds"
    >
      <article className={`${offerStyles.panel} ${styles.statusPanel}`}>
        <p className={offerStyles.label}>Сторінку не знайдено</p>
        <h1 className={offerStyles.title}>Такої сторінки немає</h1>
        <p className={offerStyles.lead}>
          Можливо, адресу набрано з помилкою або сторінку перенесли. Усе, що ви вже проходите, на
          місці — воно у вашому кабінеті.
        </p>

        <div className={styles.statusActions}>
          <Link className={styles.statusPrimaryAction} href="/">
            На головну
          </Link>
          <Link className={styles.statusSecondaryAction} href="/programs">
            Дивитись програми
          </Link>
        </div>
      </article>
    </section>
  );
}
