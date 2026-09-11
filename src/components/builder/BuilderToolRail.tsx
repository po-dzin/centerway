"use client";

import type { ReactNode } from "react";

import { HandGraphic, Icon } from "@/components/Icon";
import type { CwIconName } from "@/components/iconNames";
import styles from "./Builder.module.css";

export type BuilderToolMode = "blocks" | "block" | "page";

const TOOL_TABS = [
  { mode: "blocks", label: "Блоки", icon: "view-cards" },
  { mode: "block", label: "Властивості блоку", icon: "settings" },
  { mode: "page", label: "Властивості сторінки", icon: "document" },
] as const satisfies ReadonlyArray<{ mode: BuilderToolMode; label: string; icon: CwIconName }>;

/**
 * THE THREE MODES, AS A CONTROL OF THEIR OWN.
 *
 * Extracted on 2026-09-06 so the phone can carry them in the chrome. On a wide
 * screen they are a tab strip on the panel's edge — the handle you press to
 * change what the panel shows, beside the panel. On a phone that strip was a
 * floating plate over the lesson, a second capsule at the opposite corner from
 * the one that already holds this document's controls; two toolbars for one
 * document, and the lower one sat where the thumb rests while typing.
 *
 * Same component in both places, so a mode cannot mean one thing in the rail
 * and another in the capsule.
 */
export function BuilderToolTabs({
  mode,
  open,
  onMode,
}: {
  mode: BuilderToolMode;
  open: boolean;
  onMode: (mode: BuilderToolMode) => void;
}) {
  return (
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
  );
}

/**
 * ONE BUTTON FOR THE PANEL, in the phone's capsule.
 *
 * The three modes cannot each be an island there: with the outline and the
 * preview beside them the capsule would carry five controls, and five 44px
 * targets plus the mark and the account do not fit across a 375px row — they
 * would either shrink below the touch floor or push the account off the edge.
 * So the capsule holds the PANEL, and the panel's own head holds its modes,
 * which is where a phone puts tabs anyway: inside the thing they switch.
 */
export function BuilderToolsOrgan({
  open,
  mode,
  onOpen,
  onClose,
}: {
  open: boolean;
  mode: BuilderToolMode;
  onOpen: (mode: BuilderToolMode) => void;
  onClose: () => void;
}) {
  return (
    <button
      className={styles.toolsOrgan}
      type="button"
      aria-label="Інструменти уроку"
      title="Інструменти уроку"
      aria-expanded={open}
      onClick={() => (open ? onClose() : onOpen(mode))}
    >
      <Icon name="view-cards" size={20} />
    </button>
  );
}

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
        {/* The strip belongs to the panel and exists only where the panel is a
            column. Below 901px it is `display: none` and these same three
            controls ride in the chrome's capsule — see `BuilderToolTabs`. */}
        <div className={styles.toolModeRail}>
          <BuilderToolTabs mode={mode} open={open} onMode={onMode} />
        </div>

        <section className={styles.toolDrawer} aria-hidden={!open} inert={!open ? true : undefined}>
          {/* THE MODES LIVE IN THE HEAD ON A PHONE, and on the panel's edge
              where there is an edge to hang them on. Below 901px the title
              goes and the tabs take its place: the active tab says which mode
              this is, so keeping both would be the same word twice across a
              head that also has to hold a close button. */}
          <header className={styles.toolDrawerHead}>
            <span className={styles.toolDrawerTitle}>{current.label}</span>
            <div className={styles.toolDrawerTabs}>
              <BuilderToolTabs mode={mode} open={open} onMode={onMode} />
            </div>
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
