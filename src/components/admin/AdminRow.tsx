"use client";

import { useState, type ReactNode } from "react";

import { Icon } from "@/components/Icon";
import type { CwIconName } from "@/components/iconNames";
import lists from "@/components/admin/AdminLists.module.css";
import { InteractionInkIcon } from "@/components/platform/InteractionInk";

/**
 * ONE ADMIN ROW (2026-09-14) — the admin's half of the card system
 * (docs/card-system-2026-09-13.md → «Admin row»).
 *
 *   lead      a thumbnail, avatar or status mark — optional
 *   body      one fact per line, in this order: title · sub · badges · meta · links
 *   controls  the row's standing decisions: a state select, icon actions.
 *             Right of the body from 900px, under it on a phone.
 *   footer    full width: fields every row has (a price form, a profile).
 *
 * ONE LINE PER FACT, ON EVERY SCREEN; THE ROW UNFOLDS ON DEMAND. Wrapping lines
 * kept a phone's slug and owner on the screen but made every card a different,
 * taller height. So a line is one line with an ellipsis at every width, and the
 * title line is a disclosure: tapping it lets every line wrap in place and shows
 * the row's note. A list stays even; the full text is one tap away.
 *
 * THE NOTE LIVES INSIDE THE UNFOLDED ROW. It was an «i» at the head of the
 * controls, which pushed the select sideways on the rows that had one. Now a dot
 * on the disclosure says there is something to read — tinted when the note
 * stops a sale — and the sentence is a paragraph of the open row.
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
  const [open, setOpen] = useState(false);

  return (
    <div className={lists.row} data-has-lead={lead ? "true" : undefined} data-open={open ? "true" : undefined}>
      {lead ? <div className={lists.rowLead}>{lead}</div> : null}
      <div className={lists.rowBody}>
        <button
          type="button"
          className={lists.rowHead}
          aria-expanded={open}
          title={title}
          onClick={() => setOpen((value) => !value)}
        >
          <span className={lists.rowTitle}>{title}</span>
          <span className={lists.rowDisclosure} aria-hidden="true">
            {note ? <span className={lists.rowNoteDot} data-tone={noteTone} /> : null}
            <InteractionInkIcon>
              <Icon name="chevron-down" size={18} />
            </InteractionInkIcon>
          </span>
        </button>
        {sub ? (
          <p className={lists.rowLine} data-slot="sub" title={sub}>
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
        {open && note ? (
          <p className={lists.rowNoteText} data-tone={noteTone}>
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
