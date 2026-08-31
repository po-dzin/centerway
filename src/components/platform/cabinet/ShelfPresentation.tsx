"use client";

import type { ReactNode } from "react";

import type { CwIconName } from "@/components/iconNames";
import { Icon } from "@/components/Icon";
import { InteractionInkIcon } from "@/components/platform/InteractionInk";

import styles from "./ShelfPresentation.module.css";

export type ShelfPresentationOption<T extends string> = {
  value: T;
  label: string;
  icon: CwIconName;
};

/** Result quantity and representation always form one quiet post-filter band. */
export function ShelfResultBar({
  label,
  count,
  filtering = false,
  children,
}: {
  label: string;
  count: string;
  filtering?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={styles.resultBar} data-filtering={filtering || undefined}>
      <span className={styles.resultCount} aria-live="polite">
        <span className={styles.resultLabel}>{label}</span>
        {count}
      </span>
      {children}
    </div>
  );
}

/** One DS control for every shelf representation choice. */
export function ShelfPresentation<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly ShelfPresentationOption<T>[];
  onChange: (next: T) => void;
}) {
  return (
    <div className={styles.viewSwitch} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          className={styles.viewOption}
          type="button"
          data-cw-ink-control
          aria-label={option.label}
          aria-pressed={value === option.value}
          title={option.label}
          onClick={() => onChange(option.value)}
        >
          <InteractionInkIcon>
            <Icon name={option.icon} size={20} />
          </InteractionInkIcon>
        </button>
      ))}
    </div>
  );
}
