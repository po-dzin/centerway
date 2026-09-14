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
 *   controls  the row's standing decisions: the note's «i», a state select,
 *             icon actions. Right of the body from 900px, under it on a phone.
 *   footer    full width: fields every row has (a price form, a profile).
 *
 * THE NOTE IS AN «i», NOT A LINE. A blocker, a pending diff, a moderation hint
 * or an enquiry's message is something an operator reads on purpose, and it was
 * a line of its own — held empty on every other row to keep the list even, or
 * squeezed beside the links. It is a button in the controls now, tinted when the
 * note stops a sale, with the sentence in a popover anchored to it. A row with
 * nothing to say has no button and no line.
 *
 * ONE LINE PER FACT FROM 900PX; ON A PHONE THE LINE WRAPS. A one-line row keeps
 * a desktop list even; at 375px the same rule cut the slug, the owner and the
 * badges off at the edge. Below 900px titles take two lines and meta and badges
 * wrap, so nothing important leaves the screen.
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
  const info = note ? <AdminRowNote note={note} tone={noteTone} /> : null;

  return (
    <div className={lists.row} data-has-lead={lead ? "true" : undefined}>
      {lead ? <div className={lists.rowLead}>{lead}</div> : null}
      <div className={lists.rowBody}>
        <p className={lists.rowLine} data-slot="title" title={title}>
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
      {info || controls ? (
        <div className={lists.rowControls}>
          {info}
          {controls}
        </div>
      ) : null}
      {footer ? <div className={lists.rowFooter}>{footer}</div> : null}
    </div>
  );
}

/**
 * The row's note behind an «i». A native popover, anchored per instance: an
 * `anchor-name` written once in a stylesheet would give every row's button the
 * same name, and each popover would open beside the last row's (the same trap
 * `RequiredMark` in the cabinet documents). Without anchor positioning the
 * popover opens centred in the top layer — reachable, just not adjacent.
 */
function AdminRowNote({ note, tone }: { note: string; tone: "muted" | "alert" }) {
  const { t } = useI18n();
  const id = useId();
  const anchor = `--cw-row-note-${id.replace(/[^a-zA-Z0-9]/g, "")}`;
  const label = t("catalog_row_note" as never);

  return (
    <>
      <button
        type="button"
        className={`${lists.rowIcon} ${lists.rowNote}`}
        data-tone={tone}
        style={{ anchorName: anchor } as CSSProperties}
        popoverTarget={id}
        aria-label={label}
        title={label}
      >
        <InteractionInkIcon>
          <Icon name="info" size={18} />
        </InteractionInkIcon>
      </button>
      <p
        className={lists.rowNotePopover}
        data-tone={tone}
        style={{ positionAnchor: anchor } as CSSProperties}
        popover="auto"
        id={id}
      >
        {note}
      </p>
    </>
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
