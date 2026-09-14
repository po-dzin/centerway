import type { ReactNode } from "react";

import { Icon } from "@/components/Icon";
import type { CwIconName } from "@/components/iconNames";
import lists from "@/components/admin/AdminLists.module.css";
import { InteractionInkIcon } from "@/components/platform/InteractionInk";

/**
 * ONE ADMIN ROW (2026-09-14) — the admin's half of the card system
 * (docs/card-system-2026-09-13.md → «Admin row»).
 *
 * Every editable list in the panel — catalogue publication and prices,
 * packages, authorship, enquiries — drew the same four things in its own
 * markup: something to recognise the row by, what it is, what you can change
 * right now, and a form that opens underneath. The pieces drifted: one row
 * put its select under the text, one beside it, one in a hidden aside; «Видалити
 * курс» was a full-width button under every course. So there is one anatomy:
 *
 *   lead      a thumbnail, avatar or status mark — optional
 *   body      title (+ badges), sub, meta, notes
 *   controls  the row's standing decisions: a state select, icon actions.
 *             Right of the body from 900px, under it on a phone.
 *   footer    full width: edit forms, moderation, confirmations.
 *
 * A destructive action is an icon, never a button the width of the row — its
 * confirmation opens in the footer, so the danger is one extra step away
 * rather than one misplaced tap.
 */
export function AdminRow({
  lead,
  title,
  badges,
  sub,
  meta,
  controls,
  footer,
  children,
}: {
  lead?: ReactNode;
  title: ReactNode;
  badges?: ReactNode;
  sub?: ReactNode;
  meta?: ReactNode;
  controls?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className={lists.row} data-has-lead={lead ? "true" : undefined}>
      {lead ? <div className={lists.rowLead}>{lead}</div> : null}
      <div className={lists.rowBody}>
        <div className={lists.rowTitle}>
          <p className={lists.itemTitle}>{title}</p>
          {badges}
        </div>
        {sub ? <p className={lists.itemSub}>{sub}</p> : null}
        {meta ? <div className={lists.itemMeta}>{meta}</div> : null}
        {children}
      </div>
      {controls ? <div className={lists.rowControls}>{controls}</div> : null}
      {footer ? <div className={lists.rowFooter}>{footer}</div> : null}
    </div>
  );
}

/**
 * A compact icon action for the row's controls. Labelled for the screen
 * reader and the pointer alike (`aria-label` + `title`); `expanded` says
 * whether the thing it opens in the footer is open. `danger` only tints the
 * glyph on hover and focus — the confirmation is what carries the weight.
 */
export function AdminRowIconAction({
  icon,
  label,
  onClick,
  disabled,
  danger,
  expanded,
}: {
  icon: CwIconName;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  expanded?: boolean;
}) {
  return (
    <button
      type="button"
      className={danger ? `${lists.rowIcon} ${lists.rowIconDanger}` : lists.rowIcon}
      aria-label={label}
      title={label}
      aria-expanded={expanded}
      disabled={disabled}
      onClick={onClick}
    >
      <InteractionInkIcon>
        <Icon name={icon} size={18} />
      </InteractionInkIcon>
    </button>
  );
}
