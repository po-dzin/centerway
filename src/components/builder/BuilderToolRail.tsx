"use client";

import type { ReactNode } from "react";

import { HandGraphic, Icon } from "@/components/Icon";
import type { CwIconName } from "@/components/iconNames";
import styles from "./Builder.module.css";

export type BuilderToolMode = "blocks" | "block" | "page";

const TOOL_TABS: Array<{ mode: BuilderToolMode; label: string; icon: CwIconName }> = [
  { mode: "blocks", label: "Блоки", icon: "view-cards" },
  { mode: "block", label: "Властивості блоку", icon: "settings" },
  { mode: "page", label: "Властивості сторінки", icon: "document" },
];

/**
 * One contextual tool layer with four modes.
 *
 * The rail is a stable grid column on desktop. Switching modes never moves the
 * learner-measure document; only the content of this column changes. On mobile
 * the same DOM becomes a bottom sheet so the four modes keep one
 * keyboard/focus contract.
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
      <div className={styles.toolLayerContent}>
        <div className={styles.toolModeRail}>
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
        </div>

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
      </div>

      {/* The mirror of the outline's own foot: same row of the panel grid, same
          height, same rule above it. It sits OUTSIDE the drawer because it
          belongs to the panel, not to the mode showing inside it — collapsed,
          the drawer is gone and this control still has to be there to bring it
          back. */}
      <button
        className={styles.toolCollapseAction}
        type="button"
        onClick={() => (open ? onClose() : onMode(mode))}
        aria-label={open ? "Згорнути панель інструментів" : "Розгорнути панель інструментів"}
        aria-expanded={open}
      >
        <Icon name={open ? "arrow-right" : "arrow-left"} size={18} />
        <HandGraphic className={styles.toolTabRing} name="ink-ring" size={42} />
      </button>
    </aside>
  );
}
