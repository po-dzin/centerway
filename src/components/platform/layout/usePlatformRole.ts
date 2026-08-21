"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { ADMIN_ROLE_CACHE_KEY, ADMIN_ROLE_CACHE_TTL_MS } from "@/lib/platform/adminRole";

type Cached = { role?: string; tokenTail?: string; at?: number };

function readCache(accessToken: string): string | null {
  try {
    const raw = sessionStorage.getItem(ADMIN_ROLE_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as Cached;
    const fresh = typeof cached.at === "number" && Date.now() - cached.at < ADMIN_ROLE_CACHE_TTL_MS;
    if (!fresh || cached.tokenTail !== accessToken.slice(-16)) return null;
    return typeof cached.role === "string" ? cached.role : null;
  } catch {
    return null;
  }
}

function writeCache(accessToken: string, role: string) {
  try {
    sessionStorage.setItem(
      ADMIN_ROLE_CACHE_KEY,
      JSON.stringify({ role, tokenTail: accessToken.slice(-16), at: Date.now() }),
    );
  } catch {
    // ignore storage write errors
  }
}

/**
 * The signed-in account's platform role, or null.
 *
 * The header's standing rule is that it does not fetch per page — that is why
 * the learning entry gates on "signed in" rather than "owns a course". This
 * hook keeps that rule by sharing the admin shell's sessionStorage cache
 * (same key, same 5-minute TTL): whichever surface asks first pays, and for the
 * rest of the tab neither does. Cold, it is one POST per session.
 *
 * Returns null until resolved, so anything gated on it is absent-then-present
 * and never present-then-gone — an admin entry must not blink out mid-read.
 *
 * A failed read leaves the role null: the entry stays hidden. Hiding a link
 * someone is entitled to is a nuisance; showing one they are not is a claim
 * about their access that the admin surface would then have to refuse.
 */
export function usePlatformRole(session: Session | null): string | null {
  /* The token is stored WITH the role rather than reset in an effect. Resetting
     on sign-out would leave a frame where the previous account's role is still
     in state, and on a fast account switch that frame is an admin entry shown
     to whoever signed in next. Keyed this way the mismatch simply reads as
     "unresolved", which is the safe answer. */
  const [resolved, setResolved] = useState<{ token: string; role: string | null } | null>(null);

  useEffect(() => {
    const token = session?.access_token;
    if (!token) return;

    let cancelled = false;
    void (async () => {
      /* Inside the async body, not above it: a synchronous setState in an
         effect cascades a render, and the cache hit is the common path — every
         navigation after the first. One microtask buys a single render. */
      const cached = readCache(token);
      if (cached !== null) {
        if (!cancelled) setResolved({ token, role: cached });
        return;
      }

      try {
        const res = await fetch("/api/admin/bootstrap-role", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const payload = (await res.json().catch(() => ({}))) as { role?: string };
        const next = typeof payload.role === "string" ? payload.role : null;
        if (cancelled) return;
        setResolved({ token, role: next });
        if (next) writeCache(token, next);
      } catch {
        // Offline or transient: leave the role unresolved rather than guessing.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.access_token]);

  if (!session?.access_token) return null;
  return resolved?.token === session.access_token ? resolved.role : null;
}
