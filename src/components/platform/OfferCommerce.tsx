import Link from "next/link";
import type { ReactNode } from "react";

import { Icon } from "@/components/Icon";
import { PlatformTrail, type TrailStep } from "@/components/platform/PlatformTrail";
import type { Course } from "@/lms-core";
import type { OfferCommerce } from "@/lib/platform/offerCommerce";
import styles from "./PlatformOfferCommerce.module.css";
import offerStyles from "./PlatformOfferStyles";

/**
 * The way back up.
 *
 * A detail page is reached from an index, and until now it had no control that
 * said so — the only route back was the header item for the whole section, or
 * the browser's own button.
 *
 * Uses `PlatformTrail`, the same breadcrumb the course player and the builder
 * draw, rather than a back-link of its own. The platform briefly had both, and
 * two idioms for "where am I and how do I get out" is one more than a reader
 * should have to learn.
 *
 * Rendered under the hero rather than inside it: the hero is a photograph with
 * a dark topbar over it, and a quiet text control put there is the first thing
 * that disappears.
 */
export function OfferTrail({ steps }: { steps: TrailStep[] }) {
  return (
    <div className={styles.backRow}>
      <PlatformTrail steps={steps} />
    </div>
  );
}

/**
 * What is actually inside the course — modules and lesson titles, read from the
 * catalogue that serves the lessons themselves.
 *
 * This replaces the block that used to sit here: two generic sentences about
 * "a short entry into the system without a long commitment", written once and
 * printed on every offer regardless of what the offer contained. A reader
 * deciding whether to buy needs to know that Reset Day is three stages plus
 * recipes, not that it is short.
 *
 * Lesson TITLES, not summaries: the titles are the promise, the summaries are
 * the content, and printing the content is giving the course away.
 */
export function OfferCurriculum({ course }: { course: Course }) {
  const lessonCount = course.modules.reduce((total, module) => total + module.lessons.length, 0);

  return (
    <section
      className={`${offerStyles.container} ${offerStyles.section}`}
      data-cw-semantic-role="offer-detail"
      data-cw-semantic-family="method-progress"
      data-cw-token-source="global-app-ds"
      id="program-plan"
    >
      <article className={offerStyles.panel}>
        <p className={offerStyles.label}>Що всередині</p>
        <h2 className={offerStyles.title}>Програма курсу</h2>
        <p className={offerStyles.lead}>
          {course.summary ? inlineToText(course.summary) : null}
        </p>
        <ul className={styles.outline}>
          {course.modules.map((module) => (
            <li className={styles.outlineModule} key={module.id ?? module.title}>
              <div className={styles.outlineModuleHead}>
                <h3 className={styles.outlineModuleTitle}>{module.title}</h3>
                <span className={styles.outlineCount}>{module.lessons.length}</span>
              </div>
              <ul className={styles.outlineLessons}>
                {module.lessons.map((lesson) => (
                  <li key={lesson.slug}>{lesson.title}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <p className={styles.priceNote}>
          {course.modules.length} {plural(course.modules.length, "модуль", "модулі", "модулів")} ·{" "}
          {lessonCount} {plural(lessonCount, "урок", "уроки", "уроків")}
        </p>
      </article>
    </section>
  );
}

/**
 * The panel that sells, in place of the form that asked.
 *
 * Deliberately a plain anchor, never next/link: `/api/pay/start` is a route
 * handler that CREATES AN ORDER and redirects, and a prefetched Link would
 * open an invoice for every reader who scrolled past the button.
 *
 * The figure is the quoted price (`productListPrice`), never the charged one —
 * they diverge while the 1 ₴ QA window is open, and a page reading the charged
 * amount would advertise a hryvnia.
 */
export function OfferCheckoutPanel({
  commerce,
  label,
  title,
  lead,
  includes,
  ctaLabel,
}: {
  commerce: Extract<OfferCommerce, { mode: "checkout" }>;
  label: string;
  title: string;
  lead: string;
  includes: string[];
  ctaLabel: string;
}) {
  return (
    <article className={offerStyles.formPanel}>
      <p className={offerStyles.label}>{label}</p>
      <h2 className={offerStyles.title}>{title}</h2>

      <div className={styles.priceRow}>
        <p className={styles.priceValue}>{commerce.price}</p>
        <p className={styles.priceNote}>разова оплата</p>
      </div>

      <p className={styles.fineprint}>{lead}</p>

      <ul className={styles.includes}>
        {includes.map((item) => (
          <li key={item}>
            <Icon className={styles.includeMark} name="check" size={20} />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <a className={styles.buyAction} href={commerce.checkoutHref} rel="nofollow">
        {ctaLabel}
      </a>

      <p className={styles.fineprint}>
        Оплата карткою через WayForPay. Натискаючи кнопку, ви приймаєте{" "}
        <Link href="/legal/public-offer">публічну оферту</Link> і{" "}
        <Link href="/legal/privacy">політику конфіденційності</Link>.
      </p>
    </article>
  );
}

/** A generic panel wrapper, so the lead branch keeps the same shape as the buy one. */
export function OfferSupportPanel({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <article className={offerStyles.formPanel}>
      <p className={offerStyles.label}>{label}</p>
      <h2 className={offerStyles.title}>{title}</h2>
      {children}
    </article>
  );
}

/* Ukrainian counts take three forms, and "3 уроки / 5 уроків" is the kind of
   thing a reader notices immediately when it is wrong. */
function plural(count: number, one: string, few: string, many: string): string {
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) return many;
  const mod10 = count % 10;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

/* The catalogue's inline text is either a string or a run of spans; an offer
   page prints it flat. */
function inlineToText(value: Course["summary"]): string {
  if (typeof value === "string") return value;
  if (!Array.isArray(value)) return "";
  return value.map((span) => (typeof span === "string" ? span : span.text)).join("");
}
