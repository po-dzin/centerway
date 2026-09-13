"use client";

import { Icon } from "@/components/Icon";
import { InteractionInkIcon } from "@/components/platform/InteractionInk";
import controls from "@/components/admin/AdminControls.module.css";
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
        className={controls.disclosureHead}
        aria-expanded={open}
        title={open ? collapseLabel : expandLabel}
      >
        <div>
          <h3 className={controls.disclosureTitle}>{title}</h3>
          {note ? <p className={controls.disclosureNote}>{note}</p> : null}
        </div>
        <span className={controls.disclosureMark} aria-hidden="true">
          <InteractionInkIcon>
            <Icon
              className={open ? controls.disclosureChevronOpen : controls.disclosureChevron}
              name="chevron-down"
              size={16}
            />
          </InteractionInkIcon>
        </span>
      </button>
      {open ? <div className={controls.disclosureBody}>{children}</div> : null}
    </div>
  );
}
