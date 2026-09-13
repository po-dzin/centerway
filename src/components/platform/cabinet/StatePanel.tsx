"use client";

/**
 * The one panel every "not the page you asked for" state is drawn on.
 *
 * Shared by the wall in front of `/learn` and `/profile` (`CabinetGate`) and
 * by the email door at `/signin/email`, because those two are one surface seen
 * a step apart: someone who taps «Увійти через пошту» must not feel they have
 * left the product and arrived somewhere else. Two copies of this panel would
 * drift on padding and heading step inside a release — this file is the
 * statement that they cannot.
 */

import type { ReactNode } from "react";

import surfaceStyles from "@/components/platform/PlatformSurfaceStyles";

export function StatePanel({
  label,
  title,
  lead,
  children,
  compact,
}: {
  label: string;
  title: string;
  lead: string;
  children?: ReactNode;
  /* The states seen once — loading, error, disabled — are each an event and
     say so in the platform's editorial voice: the largest heading step, a full
     lead paragraph. A door is seen every session by everyone not signed in,
     and its job is the control below the heading, not the heading. `compact`
     is the door's own step down: the size the rest of the platform already
     uses for "present, but not the loudest thing on the page"
     (`--ds-type-display-size`, see PlatformBlocksOrientation.module.css). */
  compact?: boolean;
}) {
  return (
    <main className={surfaceStyles.profileEmptyMain} data-cw-platform-template="profile-empty">
      <section className={`${surfaceStyles.container} ${surfaceStyles.section} ${surfaceStyles.profileEmptySection}`}>
        <article
          className={`${surfaceStyles.panel} ${surfaceStyles.profileEmptyPanel} ${compact ? surfaceStyles.profileDoorPanel : ""}`}
        >
          <p className={surfaceStyles.label}>{label}</p>
          <h1 className={`${surfaceStyles.title} ${compact ? surfaceStyles.profileDoorTitle : ""}`}>{title}</h1>
          <p className={`${surfaceStyles.lead} ${compact ? surfaceStyles.profileDoorLead : ""}`}>{lead}</p>
          {children}
        </article>
      </section>
    </main>
  );
}
