/**
 * A vertical line of steps — the program's stages, a stream's days, the steps
 * after a purchase (G, 2026-10-15). One component for all three, so the three
 * cannot drift into three looks.
 *
 * The same language as the route between program-page blocks (`OfferSeam`):
 * a ring per step, a 2px dashed thread (6 on, 5 off) between rings, the steps
 * behind outlined in gold with a check, the current one filled, the ones ahead
 * grey. A page that is not walking anyone yet (a program page) passes every
 * step as `next` and the line reads as a plan rather than as progress.
 *
 * One action at most, and only on the current step: the line is a map, and a
 * button on every step is a stack of buttons.
 */

import type { ReactNode } from "react";
import { Icon } from "@/components/Icon";
import styles from "./StepLine.module.css";

export type StepLineState = "done" | "current" | "next";

export type StepLineStep = {
  id: string;
  state: StepLineState;
  /** What the ring shows: a number, usually. A done step shows a check. */
  marker: ReactNode;
  kicker?: string;
  /** A link here covers the whole step (see `.title a` in the CSS). */
  title: ReactNode;
  description?: string | null;
  /** Rendered only on the `current` step. */
  action?: ReactNode;
  /**
   * What the step holds, under its title, on every step (2026-10-16). The
   * journal is the first to use it: a day is a step, and its entries are the
   * step's content. Not an action — there is still at most one of those. A step
   * with content should not link its title: the title's link stretches over
   * the whole step and would cover the content.
   */
  content?: ReactNode;
};

export function StepLine({
  steps,
  footnote,
  className,
}: {
  steps: StepLineStep[];
  /** One quiet line under the last step: the facts the steps do not carry. */
  footnote?: string | null;
  className?: string;
}) {
  const line = (
    <ol className={className ? `${styles.line} ${className}` : styles.line}>
      {steps.map((step) => (
        <li key={step.id} className={styles.step} data-state={step.state}>
          <span className={styles.ring} aria-hidden="true">
            {step.state === "done" ? <Icon name="check" size={16} /> : step.marker}
          </span>
          <div className={styles.body}>
            {step.kicker ? <span className={styles.kicker}>{step.kicker}</span> : null}
            <span className={styles.title}>{step.title}</span>
            {step.description ? <span className={styles.description}>{step.description}</span> : null}
            {step.state === "current" && step.action ? <span className={styles.action}>{step.action}</span> : null}
            {step.content ? <div className={styles.content}>{step.content}</div> : null}
          </div>
        </li>
      ))}
    </ol>
  );
  if (!footnote) return line;
  return (
    <div className={styles.withFootnote}>
      {line}
      <p className={styles.footnote}>{footnote}</p>
    </div>
  );
}
