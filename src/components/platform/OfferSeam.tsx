/**
 * The seam between two blocks of a program page (2026-10-02).
 *
 * A program page is a run of panels — what the method is, who it is for, the
 * outline, the author, the price — and with nothing between them it read as a
 * stack of cards rather than one walk through one thing. The seam is the turn
 * of that walk: a short gold thread that fades at both ends, a ring with the
 * sign of what comes next, and a word under it.
 *
 * NOT A PHOTO PAUSE. A pause would need an image, and a program is an author's:
 * which picture belongs between their blocks is theirs to choose, not the
 * platform's to stock. Those wait until the builder can carry one. The seam is
 * the platform's own furniture, so it draws only from the icon set and from
 * facts every program already has.
 *
 * Decorative to assistive tech: the section it opens has its own heading, and
 * the caption is a signpost, not content. It lives INSIDE that section so a
 * block that does not render takes its seam with it.
 */

import { Icon } from "@/components/Icon";
import type { CwIconName } from "@/components/iconNames";
import styles from "./OfferSeam.module.css";

export function OfferSeam({ icon, caption }: { icon: CwIconName; caption: string }) {
  return (
    <div aria-hidden="true" className={styles.seam} data-cw-offer-seam="">
      <span className={styles.thread} />
      <span className={styles.ring}>
        <Icon name={icon} size={20} />
      </span>
      <span className={styles.thread} />
      <span className={styles.caption}>{caption}</span>
    </div>
  );
}
