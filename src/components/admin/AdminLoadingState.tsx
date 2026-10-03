"use client";

import { PlatformLoadingState } from "@/components/platform/PlatformLoadingState";
import states from "@/components/admin/AdminStates.module.css";

interface AdminLoadingStateProps {
  variant: "skeleton" | "spinner";
  rows?: number;
  text?: string;
  className?: string;
}

export function AdminLoadingState({ variant, rows = 5, text, className = "" }: AdminLoadingStateProps) {
  if (variant === "spinner") {
    /* THE PLATFORM'S ONE WAITING CARD (2026-10-03). The panel used to centre
       the mark above its line in a column of padding — its own shape for the
       same sentence every other wait says. It is `PlatformLoadingState` now:
       the mark and the words on one row. The house mark waiting instead of a
       rotating ring (2026-09-06) and its one size (`.cw-wait-mark`) both come
       with it. Every caller names what is loading; the fallback only keeps the
       card from rendering empty. */
    return <PlatformLoadingState title={text ?? "…"} className={className || undefined} />;
  }

  return (
    <div className={`${states.skeleton} ${className}`.trim()}>
      {[...Array(rows)].map((_, i) => (
        <div key={i} className={states.skeletonRow} />
      ))}
    </div>
  );
}
