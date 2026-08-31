import type { ReactNode } from "react";

import styles from "./PlatformShellStyles";

/**
 * ONE HEAD FOR EVERY LIST PAGE, and it answers three questions in a fixed
 * order: WHERE AM I (the label), WHAT IS THIS (the title), WHAT IS HERE AND
 * WHAT MAY I DO WITH IT (the lead, and the actions beside the title).
 *
 * It exists because the two shelves disagreed about all three. `/learn` opened
 * with a caption over an editorial title and then went straight into cards — no
 * sentence, nothing to do. `/build` opened with a title in the same face but a
 * different size, no caption at all, a lead, and two full-width text buttons on
 * the title's row. Two pages of the same product, one behind the other in the
 * same tab, and a reader crossing between them had to re-read the top to work
 * out which application they were standing in.
 *
 * THE LABEL IS THE APPLICATION, not a repeat of the title. «Бібліотека» over
 * «Мої матеріали», «Майстерня» over «Матеріали» — the pair reads as address then
 * subject. Where the title alone is the whole answer the label may be omitted;
 * where it is present it is the same caption idiom the loading state and the
 * cabinet's sections already use.
 *
 * ACTIONS SIT BESIDE THE TITLE, never below the lead. The lead is a full
 * sentence and a control after it reads as the sentence's conclusion; on the
 * title's line it reads as what this page does. They wrap under the title when
 * the line will not hold both, which on a phone is most of the time.
 *
 * The lead is not optional decoration. A list with nothing under its title
 * makes the reader infer what is in it from the cards, which is the failure the
 * shelf had: nine covers and no statement of whose they are or what tapping one
 * does.
 */
export function PlatformPageHead({
  label,
  title,
  lead,
  actions,
}: {
  /** Which application this page belongs to. Small caps, above the title. */
  label?: string;
  title: string;
  /** One sentence: what is in this list, in the reader's terms. */
  lead?: string;
  /** What can be done to the list as a whole — never per-item controls. */
  actions?: ReactNode;
}) {
  return (
    <header className={styles.pageHeadBlock}>
      <div className={styles.pageHeadLine}>
        <div className={styles.pageHeadNaming}>
          {label ? <p className={styles.pageHeadLabel}>{label}</p> : null}
          <h1 className={styles.pageHeadTitle}>{title}</h1>
        </div>
        {actions ? <div className={styles.pageHeadTools}>{actions}</div> : null}
      </div>
      {lead ? <p className={styles.pageHeadLead}>{lead}</p> : null}
    </header>
  );
}
