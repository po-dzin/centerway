"use client";

/**
 * The sphere map's read and its saves.
 *
 * OPTIMISTIC, DEBOUNCED, QUIET. A tap on the scale changes the screen at once
 * and is sent ~0.7s after the last tap, as the whole map: seven small rows, so
 * there is nothing to merge and the server's copy is always one consistent
 * state. Success says nothing — the number already moved. Failure says so in a
 * toast and leaves the change on the screen, and the next tap sends it again.
 *
 * The server's answer only replaces the HISTORY. Applying its spheres would
 * undo a tap made while the request was in flight, and the history is the one
 * part the client does not compute.
 *
 * Keyed to the account, like the journal: a switch of account must not show
 * the previous person's map for the moment the next read is in flight.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { authorizedFetch } from "@/components/auth/authorizedFetch";
import { useOptionalToast } from "@/components/ToastProvider";
import { type SphereAxisId, type SphereMap, type SphereScore, toggleFocus } from "@/lib/profile/sphereMap";

const SAVE_DELAY_MS = 700;
const ENDPOINT = "/api/platform/users/me/sphere-map";

export type SphereMapState = {
  map: SphereMap | null;
  failed: boolean;
  retry: () => void;
  setScore: (id: SphereAxisId, mode: "now" | "goal", value: number) => void;
  setNote: (id: SphereAxisId, note: string) => void;
  flipFocus: (id: SphereAxisId) => void;
};

function scoreOf(map: SphereMap, id: SphereAxisId): SphereScore {
  return map.spheres[id] ?? { now: null, goal: null };
}

export function useSphereMap(userId: string | null, saveErrorMessage: string): SphereMapState {
  const toast = useOptionalToast();
  const [loaded, setLoaded] = useState<{ userId: string; map: SphereMap } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const read = `${userId ?? ""}:${attempt}`;

  const pending = useRef<{ userId: string; map: SphereMap } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messageRef = useRef(saveErrorMessage);
  useEffect(() => {
    messageRef.current = saveErrorMessage;
  }, [saveErrorMessage]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await authorizedFetch(ENDPOINT);
        if (cancelled) return;
        if (!res.ok) {
          setFailure(read);
          return;
        }
        const body = (await res.json()) as { map: SphereMap };
        if (!cancelled) setLoaded({ userId, map: body.map });
      } catch {
        if (!cancelled) setFailure(read);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, read]);

  const flush = useCallback(async () => {
    timer.current = null;
    const next = pending.current;
    pending.current = null;
    if (!next) return;
    try {
      const res = await authorizedFetch(ENDPOINT, {
        method: "PUT",
        body: JSON.stringify({ spheres: next.map.spheres, focus: next.map.focus }),
        keepalive: true,
      });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { map: SphereMap };
      setLoaded((current) =>
        current && current.userId === next.userId
          ? { ...current, map: { ...current.map, history: body.map.history, updatedAt: body.map.updatedAt } }
          : current,
      );
    } catch {
      toast?.error(messageRef.current);
    }
  }, [toast]);

  /* A save still waiting when the page goes away is sent, not dropped. */
  useEffect(
    () => () => {
      if (timer.current) {
        clearTimeout(timer.current);
        void flush();
      }
    },
    [flush],
  );

  const change = useCallback(
    (edit: (map: SphereMap) => SphereMap) => {
      setLoaded((current) => {
        if (!current) return current;
        const next = { userId: current.userId, map: edit(current.map) };
        pending.current = next;
        return next;
      });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [flush],
  );

  const setScore = useCallback(
    (id: SphereAxisId, mode: "now" | "goal", value: number) =>
      change((map) => ({ ...map, spheres: { ...map.spheres, [id]: { ...scoreOf(map, id), [mode]: value } } })),
    [change],
  );

  const setNote = useCallback(
    (id: SphereAxisId, note: string) =>
      change((map) => {
        const { note: _previous, ...rest } = scoreOf(map, id);
        void _previous;
        return { ...map, spheres: { ...map.spheres, [id]: note ? { ...rest, note } : rest } };
      }),
    [change],
  );

  const flipFocus = useCallback(
    (id: SphereAxisId) => change((map) => ({ ...map, focus: toggleFocus(map.focus, id) })),
    [change],
  );

  return {
    map: loaded && loaded.userId === userId ? loaded.map : null,
    failed: failure === read,
    retry: () => setAttempt((value) => value + 1),
    setScore,
    setNote,
    flipFocus,
  };
}
