"use client";

import { useEffect } from "react";

import { PlatformShell } from "@/components/platform/PlatformLayout";
import { PlatformErrorPanel } from "@/components/platform/PlatformError";

/**
 * The catch for a render that threw — the missing half of `not-found.tsx`.
 *
 * `not-found()` is a page saying "there is nothing here"; this is the tree
 * saying "I could not draw what is here." Until 2026-09-09 nothing did: no
 * `error.tsx` existed anywhere in this app, so an exception unmounted the
 * page it happened in and left a blank or half-drawn screen with no way out
 * but the browser's own reload — see `PlatformErrorPanel` for the incident
 * that made this visible (a stale bfcache restore with nothing to catch it).
 *
 * `error.tsx` is a REQUIRED Client Component — Next only wires the boundary
 * for one — and it must be a leaf, not a layout: it replaces `{children}` at
 * this segment, so it renders below the platform root layout and still has
 * the SurfaceHostProvider and ToastProvider that layout wraps `{children}` in
 * (see the layout's own tree). `PlatformShell` is safe to reuse here for
 * exactly that reason.
 */
export default function PlatformErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Loud on purpose. A boundary that hides the crash it caught is a
    // boundary nobody can debug from a bug report alone.
    console.error(error);
  }, [error]);

  return (
    <PlatformShell headerMode="default">
      <main data-cw-platform-template="error">
        <PlatformErrorPanel onRetry={reset} />
      </main>
    </PlatformShell>
  );
}
