import Link from "next/link";

import { Icon } from "@/components/Icon";
import { formatPrice } from "@/lib/products";
import { bonusKindLabel } from "@/lib/platform/catalogVocabulary";
import type { ProgramFormat } from "@/lib/experiences/formats";
import {
  countdownText,
  daysUntil,
  featuredFormat,
  isPrimaryFormat,
  nearestCohort,
} from "@/lib/experiences/formatFeatured";
import { CheckoutStartLink } from "./CheckoutStartLink";
import { EarlyPriceTimer } from "./EarlyPriceTimer";
import { LeadForm } from "./LeadForm";
import styles from "./PlatformOfferCommerce.module.css";
import offerStyles from "./PlatformOfferStyles";
import css from "./OfferFormats.module.css";

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
 * ONE GOLD BUTTON IN THE ROW (G, 2026-10-03). The format the owner marked
 * «Бестселер» in the builder wears a gold pill, sits slightly raised, and keeps
 * the row's only primary button; the others go secondary (`featuredFormat`).
 * The nearest cohort ahead says so and counts the days to its start — as
 * information, without the gold.
 *
 * The anchor is `#formats`: the hero's button and a closed module inside a
 * course both lead here.
 */

const COHORT_DATE = new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long", timeZone: "UTC" });

/** «Найближчий потік · 1 листопада», with the days to it unless the early-price timer already counts. */
function cohortLine(isoDate: string | null, now: Date, nearest: boolean, counted: boolean): string | null {
  if (!isoDate) return null;
  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  const days = daysUntil(isoDate, now);
  const head = `${nearest ? "Найближчий потік" : "Старт потоку"} · ${COHORT_DATE.format(date)}`;
  return days !== null && !counted ? `${head}, ${countdownText(days)}` : head;
}

/** «До 15 жовтня 3 400 ₴, далі 4 100 ₴». */
function earlyLine(format: ProgramFormat): string | null {
  if (!format.early || format.amount === null) return null;
  const until = COHORT_DATE.format(new Date(`${format.early.until}T00:00:00Z`));
  return `До ${until} ${formatPrice(format.amount, format.currency)}, далі ${formatPrice(
    format.early.laterAmount,
    format.currency,
  )}`;
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
  const now = new Date();
  const featured = featuredFormat(formats);
  const cohort = nearestCohort(formats, now);
  return (
    <section id="formats" aria-labelledby="formats-heading" className={`${offerStyles.panel} ${css.root}`}>
      <p className={offerStyles.label}>Формати</p>
      <h2 id="formats-heading" className={offerStyles.title}>
        Як пройти «{programTitle}»
      </h2>
      <p className={offerStyles.lead}>Програма одна — різниться лише те, хто йде поруч і що ще відкривається.</p>

      <ul className={styles.bento}>
        {formats.map((format) => {
          const early = earlyLine(format);
          const start = cohortLine(format.cohortStartsOn, now, cohort === format.code, early !== null);
          const primary = isPrimaryFormat(formats, format.code);
          const action = primary ? styles.buyAction : css.secondaryAction;
          const price = format.amount !== null ? formatPrice(format.amount, format.currency) : null;
          const compareAt =
            format.listAmount !== null && format.amount !== null && format.listAmount > format.amount
              ? formatPrice(format.listAmount, format.currency)
              : null;
          return (
            <li
              key={format.code}
              className={`${styles.bentoCard} ${css.card}`}
              data-format={format.format}
              data-featured={featured === format.code ? "" : undefined}
            >
              {featured === format.code ? <p className={css.bestseller}>Бестселер</p> : null}
              <div className={styles.bentoCardHead}>
                <h3 className={styles.bentoCardTitle}>{format.label}</h3>
              </div>

              <div className={styles.priceRow}>
                {compareAt ? <s className={styles.priceOld}>{compareAt}</s> : null}
                <p className={styles.priceValue}>{price ?? "Ціна за запитом"}</p>
                {start ? <p className={styles.priceNote}>{start}</p> : null}
              </div>

              {early && format.early ? (
                <EarlyPriceTimer endsAt={format.early.endsAt} renderedAt={now.getTime()} line={early} />
              ) : null}

              {format.summary ? <p className={styles.fineprint}>{format.summary}</p> : null}

              {/* What the buyer gets, in the author's words (`features`). A
                  format nobody has described yet still says the one thing that
                  is certainly true — the program is theirs. */}
              <ul className={styles.includes}>
                {(format.features.length > 0 ? format.features : [`«${programTitle}» повністю`]).map((feature) => (
                  <li key={feature}>
                    <Icon className={`${styles.includeMark} ${css.tick}`} name="check" size={20} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* The programs a format opens besides its own, set apart: they are
                  the reason to pick this format over the one beside it, and they
                  come from the bundle, not from the copy above — so they cannot
                  promise something the purchase does not open. */}
              {format.includes.length > 0 ? (
                <div className={css.bonus}>
                  <p className={css.bonusLabel}>Бонусом</p>
                  <ul className={css.bonusList}>
                    {format.includes.map((program) => (
                      <li key={program.courseSlug} className={css.bonusRow}>
                        {program.cover ? (
                          // eslint-disable-next-line @next/next/no-img-element -- a 72px thumb of the program's own cover
                          <img className={css.bonusThumb} src={program.cover} alt="" loading="lazy" />
                        ) : null}
                        <span className={css.bonusText}>
                          <span className={css.bonusKind}>
                            {[program.tag ?? bonusKindLabel(program.kind), program.duration]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                          <Link className={css.bonusTitle} href={`/programs/${program.programSlug}`}>
                            {program.title}
                          </Link>
                          {program.separateAmount ? (
                            <span className={css.bonusPrice}>
                              окремо {formatPrice(program.separateAmount, program.currency ?? format.currency)}
                            </span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className={css.action}>
                {format.mode === "checkout" && price ? (
                  <CheckoutStartLink
                    className={action}
                    href={formatCheckoutHref(format.code, programSlug)}
                    label={primary ? `Оплатити ${price}` : "Обрати"}
                  />
                ) : format.mode === "lead" ? (
                  <a className={action} href={`#format-request-${format.code}`}>
                    Залишити заявку
                  </a>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {/* The enquiry lives under the row, not inside its card: a form in the
          third card stretched the whole row to its height and left the two
          priced cards standing over empty space. It stays folded until its
          card's button is pressed (`:target`) — an open form under three prices
          read as a fourth thing to fill in rather than the answer to one. */}
      {formats
        .filter((format) => format.mode === "lead")
        .map((format) => (
          <div key={format.code} id={`format-request-${format.code}`} className={css.request}>
            <h3 className={styles.bentoCardTitle}>Заявка: {format.label.toLowerCase()}</h3>
            <p className={styles.fineprint}>
              Цей формат узгоджуємо в розмові — залиште контакт, і ми повернемося з деталями та способом оплати.
            </p>
            <LeadForm
              productCode={format.code}
              source={`platform_${programSlug}_format`}
              ctaPlace={`${programSlug}_format_${format.code}`}
            />
          </div>
        ))}

      <p className={styles.fineprint}>
        Оплата карткою через WayForPay. Натискаючи кнопку, ви приймаєте{" "}
        <Link href="/legal/public-offer">публічну оферту</Link> і{" "}
        <Link href="/legal/privacy">політику конфіденційності</Link>.
      </p>
    </section>
  );
}
