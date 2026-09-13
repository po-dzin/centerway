"use client";

import { LogoMark } from "@/components/brand/LogoMark";
import states from "@/components/admin/AdminStates.module.css";

interface AdminLoadingStateProps {
  variant: "skeleton" | "spinner";
  rows?: number;
  text?: string;
  className?: string;
}

export function AdminLoadingState({ variant, rows = 5, text, className = "" }: AdminLoadingStateProps) {
  if (variant === "spinner") {
    return (
      <div className={`${states.waiting} ${className}`.trim()}>
        {/* THE HOUSE MARK WAITS (2026-09-06). This was a rotating ring drawn
            from Tailwind's `animate-spin` — a glyph from no design system in
            particular, and the one waiting state in the product that said
            «something is happening» without saying what. `LogoMark`'s `wait`
            has been the answer since it was written («the spinner
            replacement», in its own source), and the panel's own words below
            say the rest.

            The note that used to sit here said the panel «runs its own grey
            Tailwind skin and `--ds-*` may not be pulled into it». That was a
            description of a problem, not a rule, and as of 2026-09-12 it is
            being undone: the admin is on the same tokens as everything else.

            THE SAME SIZE AS EVERY OTHER WAIT (see `.cw-wait-mark`). This was
            `size={32}` — a speck, which is the exact complaint the platform's
            own loading card had already fixed and written down; the number
            simply never crossed into the panel. The `size` prop stays as the
            intrinsic viewBox; the class is what the reader sees. */}
        <LogoMark className="cw-wait-mark" size={32} animate="wait" tone="brand" aria-hidden="true" />
        {text ? <span className={states.waitingText}>{text}</span> : null}
      </div>
    );
  }

  return (
    <div className={`${states.skeleton} ${className}`.trim()}>
      {[...Array(rows)].map((_, i) => (
        <div key={i} className={states.skeletonRow} />
      ))}
    </div>
  );
}
