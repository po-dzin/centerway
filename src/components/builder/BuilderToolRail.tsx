"use client";

import type { ReactNode } from "react";

import { HandGraphic, Icon } from "@/components/Icon";
import type { CwIconName } from "@/components/iconNames";
import styles from "./Builder.module.css";

export type BuilderToolMode = "blocks" | "block" | "page" | "publish";

const TOOL_TABS: Array<{ mode: BuilderToolMode; label: string; icon: CwIconName }> = [
  { mode: "blocks", label: "Блоки", icon: "view-cards" },
  { mode: "block", label: "Властивості блоку", icon: "settings" },
  { mode: "page", label: "Властивості сторінки", icon: "document" },
  { mode: "publish", label: "Публікація", icon: "shield-check" },
];

/**
 * One contextual tool layer with four modes.
 *
 * The rail is persistent on desktop, while the ceramic drawer is optional.
 * Switching modes never moves the learner-measure document: this component is
 * an overlay in the reserved authoring gutter. On mobile the same DOM becomes
 * a bottom sheet so the four modes keep one keyboard/focus contract.
 */
export function BuilderToolRail({
  mode,
  open,
  onMode,
  onClose,
  children,
}: {
  mode: BuilderToolMode;
  open: boolean;
  onMode: (mode: BuilderToolMode) => void;
  onClose: () => void;
  children: ReactNode;
}) {
  const current = TOOL_TABS.find((tab) => tab.mode === mode) ?? TOOL_TABS[0];

  return (
    <aside className={styles.toolLayer} data-open={open || undefined} aria-label="Інструменти уроку">
      <nav className={styles.toolTabs} aria-label="Режими інструментів">
        {TOOL_TABS.map((tab) => {
          const active = tab.mode === mode;
          return (
            <button
              key={tab.mode}
              className={styles.toolTab}
              type="button"
              aria-label={tab.label}
              title={tab.label}
              aria-pressed={active && open}
              onClick={() => onMode(tab.mode)}
            >
              <Icon name={tab.icon} size={20} />
              <HandGraphic className={styles.toolTabRing} name="ink-ring" size={42} />
            </button>
          );
        })}
      </nav>

      <section className={styles.toolDrawer} aria-hidden={!open} inert={!open ? true : undefined}>
        <header className={styles.toolDrawerHead}>
          <span className={styles.toolDrawerTitle}>{current.label}</span>
          <button className={styles.toolClose} type="button" onClick={onClose} aria-label="Згорнути панель">
            <Icon name="close" size={20} />
            <HandGraphic className={styles.toolTabRing} name="ink-ring" size={42} />
          </button>
        </header>
        <div className={styles.toolDrawerBody}>{children}</div>
      </section>
    </aside>
  );
}
