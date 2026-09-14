"use client";

import { useId, type CSSProperties, type ReactNode } from "react";

import { Icon } from "@/components/Icon";
import { useI18n } from "@/components/I18nProvider";
import type { CwIconName } from "@/components/iconNames";
import lists from "@/components/admin/AdminLists.module.css";
import { InteractionInkIcon } from "@/components/platform/InteractionInk";

/**
 * ONE ADMIN ROW (2026-09-14) — the admin's half of the card system
 * (docs/card-system-2026-09-13.md → «Admin row»).
 *
 *   lead      a thumbnail, avatar or status mark — optional
 *   body      one fact per line, in this order: title · sub · badges · meta · links
 *   controls  the row's standing decisions: a state select, a stage.
 *             Right of the body from 900px, under it on a phone.
 *   corner    top-right at every width: the «i», then the icon `actions`
 *             (delete, owner). An icon never takes a line of its own.
 *   footer    full width: fields every row has (a price form, a profile).
 *
 * ONE LINE PER FACT, ON EVERY SCREEN; THE FULL TEXT OPENS OVER THE ROW. Wrapping
 * lines made every card a different height, and unfolding the row in place made
 * the tapped card grow and push the list. So a line is one line with an ellipsis
 * at every width, and the «i» opens a popover over the list with every fact
 * unclipped and the row's note. The list never moves.
 *
 * A dot on the «i» circle, at 45° up and to the right, says the row has a note —
 * tinted when the note stops a sale.
 *
 * Destructive actions are icons in the corner; their confirmation is a dialog,
 * never a form unfolding inside the row.
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
  actions,
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
  actions?: ReactNode;
  footer?: ReactNode;
}) {
  const { t } = useI18n();
  const id = useId();
  /* Anchored per instance: an `anchor-name` written once in a stylesheet would
     give every row's «i» the same name, and each popover would open beside the
     last row's. Without anchor positioning it opens centred in the top layer. */
  const anchor = `--cw-row-info-${id.replace(/[^a-zA-Z0-9]/g, "")}`;
  const label = t("catalog_row_info");

  return (
    <div className={lists.row} data-has-lead={lead ? "true" : undefined}>
      {lead ? <div className={lists.rowLead}>{lead}</div> : null}
      <div className={lists.rowBody}>
        <p className={lists.rowTitle} title={title}>
          {title}
        </p>
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
      </div>
      {controls ? <div className={lists.rowControls}>{controls}</div> : null}
      <div className={lists.rowCorner}>
        <button
          type="button"
          className={lists.rowIcon}
          style={{ anchorName: anchor } as CSSProperties}
          popoverTarget={id}
          aria-label={label}
          title={label}
        >
          <InteractionInkIcon>
            <Icon name="info" size={24} />
          </InteractionInkIcon>
          {note ? <span className={lists.rowNoteDot} data-tone={noteTone} aria-hidden="true" /> : null}
        </button>
        {actions}
      </div>
      <div
        className={lists.rowInfo}
        data-tone={note ? noteTone : undefined}
        style={{ positionAnchor: anchor } as CSSProperties}
        popover="auto"
        id={id}
      >
        <p className={lists.rowInfoTitle}>{title}</p>
        {sub ? <p className={lists.rowInfoLine}>{sub}</p> : null}
        {badges !== undefined ? <div className={lists.rowInfoBadges}>{badges}</div> : null}
        {meta !== undefined ? <div className={lists.rowInfoLine}>{meta}</div> : null}
        {note ? (
          <p className={lists.rowInfoNote} data-tone={noteTone}>
            {note}
          </p>
        ) : null}
      </div>
      {footer ? <div className={lists.rowFooter}>{footer}</div> : null}
    </div>
  );
}

/**
 * A compact icon action for the row's corner. Labelled for the screen reader
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
        <Icon name={icon} size={24} />
      </InteractionInkIcon>
    </button>
  );
}
