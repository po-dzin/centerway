import type { ReactNode } from "react";

import { Icon } from "@/components/Icon";
import type { CwIconName } from "@/components/iconNames";
import lists from "@/components/admin/AdminLists.module.css";
import { InteractionInkIcon } from "@/components/platform/InteractionInk";

/**
 * ONE ADMIN ROW (2026-09-14) — the admin's half of the card system
 * (docs/card-system-2026-09-13.md → «Admin row»).
 *
 *   lead      a thumbnail, avatar or status mark — optional
 *   body      one fixed line per fact, in this order:
 *               title · sub · badges · meta · links · note
 *   controls  the row's standing decisions: a state select, icon actions.
 *             Right of the body from 900px, under it on a phone.
 *   footer    full width: edit forms and moderation.
 *
 * EVERY FACT HAS ITS OWN LINE, AND EACH LINE IS ONE LINE (2026-09-14). The
 * first pass put the badges beside the title, so a short title pulled four
 * status chips up onto its line and a long one pushed them onto the next: two
 * rows of the same list, two shapes. Now the title is alone on the first line,
 * the badges have the second, the meta the third — and none of them wraps:
 * titles and meta end in an ellipsis with the full text on hover, badges scroll
 * sideways. A row's height is therefore the number of slots it has, which is
 * the same for every row a list renders.
 *
 * `undefined` omits a slot; `null` keeps its line empty. A list whose rows only
 * sometimes have a note passes `null` for the rest, so the note line is held
 * and the rows stay the same height. The note is the LAST line for that reason:
 * held empty at the foot of the body it reads as the card's own padding, where
 * between the meta and the links it read as a hole (2026-09-14).
 *
 * Destructive actions are icons in the controls; their confirmation is a
 * dialog, never a form unfolding inside the row.
 */
export function AdminRow({
  lead,
  title,
  sub,
  badges,
  meta,
  note,
  noteTone = "muted",
  links,
  controls,
  footer,
}: {
  lead?: ReactNode;
  title: string;
  sub?: string | null;
  badges?: ReactNode;
  meta?: ReactNode;
  note?: string | null;
  noteTone?: "muted" | "alert";
  links?: ReactNode;
  controls?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className={lists.row} data-has-lead={lead ? "true" : undefined}>
      {lead ? <div className={lists.rowLead}>{lead}</div> : null}
      <div className={lists.rowBody}>
        <p className={lists.rowLine} data-slot="title" title={title}>
          {title}
        </p>
        {sub !== undefined ? (
          <p className={lists.rowLine} data-slot="sub" title={sub ?? undefined}>
            {sub}
          </p>
        ) : null}
        {badges !== undefined ? (
          <div className={lists.rowBadges} data-slot="badges">
            {badges}
          </div>
        ) : null}
        {meta !== undefined ? (
          <div className={lists.rowLine} data-slot="meta">
            {meta}
          </div>
        ) : null}
        {links !== undefined ? (
          <div className={lists.rowLine} data-slot="links">
            {links}
          </div>
        ) : null}
        {note !== undefined ? (
          <p
            className={lists.rowLine}
            data-slot="note"
            data-tone={note ? noteTone : undefined}
            title={note ?? undefined}
          >
            {note}
          </p>
        ) : null}
      </div>
      {controls ? <div className={lists.rowControls}>{controls}</div> : null}
      {footer ? <div className={lists.rowFooter}>{footer}</div> : null}
    </div>
  );
}

/**
 * A compact icon action for the row's controls. Labelled for the screen reader
 * and the pointer alike (`aria-label` + `title`). `danger` only tints the glyph
 * on hover and focus — the confirmation dialog is what carries the weight.
 */
export function AdminRowIconAction({
  icon,
  label,
  onClick,
  disabled,
  danger,
  opensDialog,
}: {
  icon: CwIconName;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  opensDialog?: boolean;
}) {
  return (
    <button
      type="button"
      className={danger ? `${lists.rowIcon} ${lists.rowIconDanger}` : lists.rowIcon}
      aria-label={label}
      title={label}
      aria-haspopup={opensDialog ? "dialog" : undefined}
      disabled={disabled}
      onClick={onClick}
    >
      <InteractionInkIcon>
        <Icon name={icon} size={18} />
      </InteractionInkIcon>
    </button>
  );
}
