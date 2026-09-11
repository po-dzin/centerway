"use client";

import { Icon } from "@/components/Icon";
import { InteractionInkIcon } from "@/components/platform/InteractionInk";
import surfaces from "@/components/admin/AdminSurfaces.module.css";

/* A diagnostics panel: a heading that opens what is under it. Three of them sit
   on the inputs/quality tab, which is why it is a component and not three
   copies of the same disclosure. */
export function AnalyticsCollapsePanel(props: {
  title: string;
  note?: string;
  open: boolean;
  onToggle: () => void;
  expandLabel: string;
  collapseLabel: string;
  children: React.ReactNode;
}) {
  const { title, note, open, onToggle, expandLabel, collapseLabel, children } = props;
  return (
    <div className={surfaces.plate}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-start justify-between gap-3 text-left"
        aria-expanded={open}
      >
        <div>
          <h3 className="text-sm font-semibold cw-text">{title}</h3>
          {note ? <p className="text-xs cw-muted mt-1">{note}</p> : null}
        </div>
        <span
          className="cw-icon-btn shrink-0 inline-flex items-center justify-center"
          aria-label={open ? collapseLabel : expandLabel}
          title={open ? collapseLabel : expandLabel}
        >
          <InteractionInkIcon>
            <Icon className={`transition-transform ${open ? "rotate-180" : ""}`} name="chevron-down" size={16} />
          </InteractionInkIcon>
        </span>
      </button>
      {open ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}
