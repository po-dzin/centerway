/**
 * The seam between two blocks of a program page — a route (G, 2026-10-03).
 *
 * A program page is a run of panels, and with nothing between them it read as
 * a stack of cards rather than one walk through one thing. The first seam was
 * a ring with one word; G approved the route instead (artifact «Акценти
 * карток», «Шов-маршрут»): the page's steps in a row — the method, whether it
 * is for you, the programme, the formats — the steps behind outlined in gold,
 * the one this block opens filled, the thread between them filling as the
 * reader goes. Icons and their labels are the complete signpost; the section
 * below owns its facts.
 *
 * NOT TIED TO SCROLL. Each seam draws the step of its own block, server-side,
 * without JavaScript; the route reads the same at every seam, only the filled
 * ring moves.
 *
 * Decorative to assistive tech: the section it opens has its own heading, and
 * the route is a signpost of what that section says. It lives INSIDE the
 * section so a block that does not render takes its seam with it.
 */

import { Icon } from "@/components/Icon";
import type { CwIconName } from "@/components/iconNames";
import styles from "./OfferSeam.module.css";

export type RouteStep = { icon: CwIconName; label: string };

export function OfferSeam({
  steps,
  current,
}: {
  steps: RouteStep[];
  /** Index in `steps` of the block this seam opens. */
  current: number;
}) {
  return (
    <div aria-hidden="true" className={styles.seam} data-cw-offer-seam="">
      <ol className={styles.route}>
        {steps.map((step, index) => (
          <li
            key={step.label}
            className={styles.step}
            data-state={index < current ? "done" : index === current ? "current" : "next"}
          >
            <span className={styles.ring}>
              <Icon name={step.icon} size={20} />
            </span>
            <span className={styles.label}>{step.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
