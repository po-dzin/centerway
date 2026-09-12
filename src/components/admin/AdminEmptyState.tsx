"use client";

import type { ReactNode } from "react";

import states from "@/components/admin/AdminStates.module.css";

interface AdminEmptyStateProps {
  icon: ReactNode;
  description: ReactNode;
  title?: ReactNode;
}

/**
 * "There is nothing here", in the one shape the admin uses for it.
 *
 * It used to take `className` and `iconWrapperClassName`, and every call site
 * used both — the same `py-16` eight times and the same round badge six — so
 * the component's own look was decided eight times over and disagreed twice.
 * Both props are gone; see AdminStates.module.css.
 */
export function AdminEmptyState({ icon, description, title }: AdminEmptyStateProps) {
  return (
    <div className={states.empty}>
      <div className={states.emptyBadge}>{icon}</div>
      {title ? <h3 className={states.emptyTitle}>{title}</h3> : null}
      <p className={title ? states.emptyTextUnderTitle : states.emptyText}>{description}</p>
    </div>
  );
}
