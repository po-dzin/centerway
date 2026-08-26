"use client";

/**
 * The closing block, after it stops being an offer.
 *
 * A page that sells ends in a price and a button. For someone who has already
 * paid, that same block is the page's worst moment: it says «Відкрити доступ»
 * to a person who has it and offers to charge them a second time for it. The
 * hero already tells the truth by then, which makes the contradiction worse
 * rather than better — the page disagrees with itself between the top and the
 * bottom of one scroll.
 *
 * TAKES THE SALES PAIR AS A CHILD, rather than rebuilding it. Everything a
 * stranger sees here — the checkout panel, the lead form, the offer terms — is
 * server-rendered and stays that way; this only decides whether to show it.
 */

import Link from "next/link";
import type { ReactNode } from "react";

import { useOfferAccess } from "@/components/platform/OfferAccess";
import { useSurfaceHref } from "@/components/platform/layout/SurfaceHost";
import commerceStyles from "./PlatformOfferCommerce.module.css";
import styles from "./PlatformOfferStyles";

export function OfferSupport({ sales, title }: { sales: ReactNode; title: string }) {
  const access = useOfferAccess();
  const surfaceHref = useSurfaceHref();

  // `unknown` shows the pitch, exactly as the hero does: a stranger must never
  // see the owner's version, and a buyer seeing the pitch for one request is
  // recoverable.
  if (access.state !== "owned") return <>{sales}</>;

  const { shelf } = access;
  const finished = shelf.standing?.isFinished ?? false;
  const resumeHref =
    shelf.access === "enrolled" && shelf.currentLessonSlug && !finished
      ? `/learn/${shelf.slug}/${shelf.currentLessonSlug}`
      : `/learn/${shelf.slug}`;

  return (
    <>
      <article className={styles.panel}>
        <p className={styles.label}>Ваш доступ</p>
        <h2 className={styles.title}>{`«${title}» вже відкрито`}</h2>
        <p className={styles.lead}>
          {finished
            ? "Ви пройшли цей курс. Матеріали залишаються у кабінеті — протокол можна повторити будь-коли."
            : shelf.currentLessonTitle
              ? `Ви зупинилися на уроці «${shelf.currentLessonTitle}». Продовжити можна звідси або з полиці в кабінеті.`
              : "Курс чекає у вашому кабінеті. Почати можна звідси або з полиці."}
        </p>
      </article>
      <article className={styles.formPanel}>
        <p className={styles.label}>Продовжити</p>
        <h2 className={styles.title}>Перейти до матеріалів</h2>
        <Link className={commerceStyles.resumeAction} href={surfaceHref(resumeHref)} data-cw-offer-cta>
          {finished ? "Відкрити курс" : shelf.access === "available" ? "Почати навчання" : "Продовжити навчання"}
        </Link>
        {/* The shelf, not just this course. Someone who finished one protocol is
            the likeliest person to start another, and the cabinet is where the
            rest of theirs is. */}
        <Link className={commerceStyles.shelfAction} href={surfaceHref("/learn")}>
          Усі мої курси
        </Link>
      </article>
    </>
  );
}
