"use client";

/**
 * The reader's previous run of a test, for «Минулого разу, 12.09: …» on the
 * full result (2026-10-02). Asked only once the result on screen is saved —
 * before that there is no account to ask about — and never twice for the
 * same attempt. Null when this is the first run or the read failed: the line
 * is simply absent, a comparison is never invented.
 */

import { useEffect, useState } from "react";

import { authorizedFetch } from "@/components/auth/authorizedFetch";

export type PreviousRun = { attemptId: string; completedAt: string | null; reading: string };

export function usePreviousRun(
  testSlug: string,
  currentAttemptId: string | null,
  enabled: boolean,
): PreviousRun | null {
  const [previous, setPrevious] = useState<{ for: string | null; run: PreviousRun | null }>({ for: null, run: null });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      const res = await authorizedFetch(`/api/tests/${testSlug}/history`).catch(() => null);
      const data = res?.ok ? ((await res.json()) as { runs?: PreviousRun[] }) : null;
      const runs = data?.runs ?? [];
      /* The run on screen is the newest; when its id is not known yet (the
         anonymous save had not come back), it is still the first row. */
      const before = currentAttemptId ? runs.find((run) => run.attemptId !== currentAttemptId) : runs[1];
      if (!cancelled) setPrevious({ for: currentAttemptId, run: before ?? null });
    })();
    return () => {
      cancelled = true;
    };
  }, [currentAttemptId, enabled, testSlug]);

  return enabled && previous.for === currentAttemptId ? previous.run : null;
}

/** «12.09» — the day of a run, in the reader's calendar. */
export function runDay(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit" });
}
