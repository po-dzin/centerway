import Link from "next/link";

import { Icon } from "@/components/Icon";
import { formatPrice } from "@/lib/products";
import type { ProgramFormat } from "@/lib/experiences/formats";
import { CheckoutStartLink } from "./CheckoutStartLink";
import { LeadForm } from "./LeadForm";
import styles from "./PlatformOfferCommerce.module.css";
import offerStyles from "./PlatformOfferStyles";

/**
 * THE FORMATS OF A PROGRAM, SIDE BY SIDE (2026-09-25).
 *
 * One program, several ways through it: on your own, in a cohort, with a guide.
 * Each card says what the format costs, when it starts if it has a start, what
 * else it opens, and how to take it — a checkout for a priced format, the
 * enquiry form for one agreed in conversation. The programs a format includes
 * link to their own pages: they are sold on their own too, and a reader deciding
 * between formats is entitled to see what the extra is.
 *
 * The anchor is `#formats`: the hero's button and a closed module inside a
 * course both lead here.
 */

const COHORT_DATE = new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long", timeZone: "UTC" });

function cohortLine(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const date = new Date(`${isoDate}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : `Старт потоку — ${COHORT_DATE.format(date)}`;
}

function kindLabel(kind: ProgramFormat["includes"][number]["kind"]): string {
  return kind === "mini" ? "міні-курс" : kind === "checklist" ? "чек-лист" : "програма";
}

function formatCheckoutHref(code: string, programSlug: string): string {
  return `/api/pay/start?product=${encodeURIComponent(code)}&cta_place=${encodeURIComponent(
    `${programSlug}_format_${code}`,
  )}&source=platform_offer`;
}

export function OfferFormats({
  programSlug,
  programTitle,
  formats,
}: {
  programSlug: string;
  programTitle: string;
  formats: ProgramFormat[];
}) {
  return (
    <section id="formats" aria-labelledby="formats-heading" className={offerStyles.panel}>
      <p className={offerStyles.label}>Формати</p>
      <h2 id="formats-heading" className={offerStyles.title}>
        Як пройти «{programTitle}»
      </h2>
      <p className={offerStyles.lead}>Програма одна — різниться лише те, хто йде поруч і що ще відкривається.</p>

      <ul className={styles.bento}>
        {formats.map((format) => {
          const start = cohortLine(format.cohortStartsOn);
          const price = format.amount !== null ? formatPrice(format.amount, format.currency) : null;
          const compareAt =
            format.listAmount !== null && format.amount !== null && format.listAmount > format.amount
              ? formatPrice(format.listAmount, format.currency)
              : null;
          return (
            <li key={format.code} className={styles.bentoCard} data-format={format.format}>
              <div className={styles.bentoCardHead}>
                <h3 className={styles.bentoCardTitle}>{format.label}</h3>
              </div>

              <div className={styles.priceRow}>
                {compareAt ? <s className={styles.priceOld}>{compareAt}</s> : null}
                <p className={styles.priceValue}>{price ?? "Ціна за запитом"}</p>
                {start ? <p className={styles.priceNote}>{start}</p> : null}
              </div>

              {format.summary ? <p className={styles.fineprint}>{format.summary}</p> : null}

              <ul className={styles.includes}>
                <li>
                  <Icon className={styles.includeMark} name="check" size={20} />
                  <span>«{programTitle}» повністю</span>
                </li>
                {format.includes.map((program) => (
                  <li key={program.courseSlug}>
                    <Icon className={styles.includeMark} name="check" size={20} />
                    <span>
                      <Link href={`/programs/${program.programSlug}`}>{program.title}</Link> — {kindLabel(program.kind)}
                    </span>
                  </li>
                ))}
              </ul>

              {format.mode === "checkout" && price ? (
                <CheckoutStartLink
                  className={styles.buyAction}
                  href={formatCheckoutHref(format.code, programSlug)}
                  label={`Оплатити ${price}`}
                />
              ) : format.mode === "lead" ? (
                <LeadForm
                  productCode={format.code}
                  source={`platform_${programSlug}_format`}
                  ctaPlace={`${programSlug}_format_${format.code}`}
                />
              ) : null}
            </li>
          );
        })}
      </ul>

      <p className={styles.fineprint}>
        Оплата карткою через WayForPay. Натискаючи кнопку, ви приймаєте{" "}
        <Link href="/legal/public-offer">публічну оферту</Link> і{" "}
        <Link href="/legal/privacy">політику конфіденційності</Link>.
      </p>
    </section>
  );
}
