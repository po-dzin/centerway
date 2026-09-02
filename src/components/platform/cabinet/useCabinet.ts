"use client";

/**
 * The reads behind "mine", split so each page takes only what it renders.
 *
 * `/learn` needs the session and the shelf. `/profile` needs the session, the
 * profile and — for one card — the shelf. When both lived in one component the
 * shelf page could not exist without also waiting on the profile endpoint; now
 * the split is the point of the split.
 *
 * The two reads stay independent in failure, too: a broken LMS read must not
 * blank the dashboard, so it surfaces as a card, not a page state.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabaseClient } from "@/lib/supabaseClient";
import { fetchMyCourses, type LearnerShelfCourseDto } from "@/components/lms/lmsClient";
import type { ProfileLang, ProfileResponse } from "@/components/platform/profile/types";
import type { Author } from "@/lms-core";

const LANG_EVENT = "cw-lang-change";

export const isAuthEnabled = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

function resolveProfileLang(): ProfileLang {
  if (typeof window !== "undefined") {
    try {
      if (window.localStorage.getItem("lang") === "en") return "en";
    } catch {
      // ignore storage read errors
    }
  }

  if (typeof document !== "undefined" && document.documentElement.lang.toLowerCase().startsWith("en")) {
    return "en";
  }

  return "uk";
}

export function useProfileLang(): ProfileLang {
  const [lang, setLang] = useState<ProfileLang>("uk");

  useEffect(() => {
    const sync = () => setLang(resolveProfileLang());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(LANG_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(LANG_EVENT, sync);
    };
  }, []);

  return lang;
}

export type CabinetSessionState = {
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

/**
 * Whether two sessions are the same answer to "who is signed in, with what".
 *
 * supabase-js hands back a NEW object for `INITIAL_SESSION` and `SIGNED_IN`
 * even when they describe the session `getSession()` just returned. Published
 * as-is, each one is a fresh identity for every consumer downstream.
 */
export function sameSession(a: Session | null, b: Session | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.user?.id === b.user?.id && a.access_token === b.access_token;
}

export function useCabinetSession(): CabinetSessionState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isAuthEnabled);

  useEffect(() => {
    if (!isAuthEnabled) return;

    /* Published through `sameSession` rather than straight into state: a page
       load produces the restored session plus one or two auth events that
       describe it again, and each one used to re-render the whole cabinet. */
    const publish = (next: Session | null) =>
      setSession((current) => (sameSession(current, next) ? current : next));

    void supabaseClient.auth.getSession().then(({ data }) => {
      publish(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, nextSession) => publish(nextSession));

    return () => subscription.unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const redirectTo = typeof window !== "undefined" ? window.location.href : undefined;
    await supabaseClient.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
  }, []);

  const signOut = useCallback(async () => {
    await supabaseClient.auth.signOut();
    setSession(null);
  }, []);

  return { session, loading, signInWithGoogle, signOut };
}

/**
 * Reads an endpoint with the session token, refreshing once on a 401.
 *
 * A token that expired between restore and first read returns 401 exactly
 * once. Refreshing and retrying beats showing "could not assemble the profile"
 * to a signed-in user whose session is perfectly valid.
 */
async function readWithToken(url: string, session: Session): Promise<Response | null> {
  const read = (token: string) => fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  if (!session.access_token) return null;
  let res = await read(session.access_token);

  if (res.status === 401) {
    const { data: refreshed } = await supabaseClient.auth.refreshSession();
    if (refreshed.session?.access_token) res = await read(refreshed.session.access_token);
  }

  return res;
}

/** `readWithToken`'s write counterpart — same one-refresh-on-401 retry. */
async function readWithTokenPost(url: string, session: Session, body: unknown): Promise<Response | null> {
  const post = (token: string) =>
    fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  if (!session.access_token) return null;
  let res = await post(session.access_token);

  if (res.status === 401) {
    const { data: refreshed } = await supabaseClient.auth.refreshSession();
    if (refreshed.session?.access_token) res = await post(refreshed.session.access_token);
  }

  return res;
}

/**
 * The freshest session, reachable from an effect that does not depend on it.
 *
 * The three reads below are keyed on the ACCOUNT, not on the session object or
 * on its token — a refreshed token is the same person and the same answer, and
 * re-reading three endpoints for it is work with no result. But the read still
 * has to send the newest token, so it comes from here rather than from what the
 * effect closed over. A stale token is survivable anyway: `readWithToken`
 * refreshes once on a 401.
 *
 * The ref is written in an effect declared BEFORE the reads, so on the render
 * where a session first appears it is already current by the time they run.
 */
function useLatestSession(session: Session | null) {
  const ref = useRef(session);
  useEffect(() => {
    ref.current = session;
  });
  return ref;
}

/**
 * Data is stamped with the user it was read for, and the stamp is compared on
 * render rather than cleared in an effect. Clearing would be a setState inside
 * the effect body — a cascading render — and worse, it would leave one frame in
 * which the previous account's profile is still on screen after a switch.
 */
export function useProfileData(session: Session | null) {
  const userId = session?.user?.id ?? null;
  const [state, setState] = useState<{ userId: string | null; profile: ProfileResponse | null }>({
    userId: null,
    profile: null,
  });
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useLatestSession(session);

  useEffect(() => {
    const current = sessionRef.current;
    if (!current?.access_token) return;

    let cancelled = false;

    void (async () => {
      const res = await readWithToken("/api/platform/users/me/profile", current);
      if (cancelled) return;

      if (!res?.ok) {
        setError("Не вдалося завантажити кабінет.");
        return;
      }

      setState({ userId: current.user?.id ?? null, profile: (await res.json()) as ProfileResponse });
      // Clears a failure left by an earlier attempt — React runs this effect
      // twice in dev, and the first pass can lose a token-refresh race.
      setError(null);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, sessionRef]);

  const profile = state.userId === userId ? state.profile : null;
  const clear = useCallback(() => setState({ userId: null, profile: null }), []);

  /* Derived, not a third piece of state: "signed in, no profile yet, nothing
     failed" IS the loading condition, and a boolean kept beside it could only
     ever disagree with it. */
  return { profile, loading: Boolean(session) && !profile && !error, error, clear };
}

export function useLearnerShelf(session: Session | null) {
  const userId = session?.user?.id ?? null;
  const [state, setState] = useState<{ userId: string | null; courses: LearnerShelfCourseDto[] | null }>({
    userId: null,
    courses: null,
  });
  const [failed, setFailed] = useState(false);
  /* The retry button asks for a re-read by bumping this, rather than by calling
     the loader directly: the read belongs to the effect that owns the session,
     and one loader with one owner cannot race a second copy of itself. */
  const [attempt, setAttempt] = useState(0);
  const sessionRef = useLatestSession(session);

  useEffect(() => {
    const current = sessionRef.current;
    if (!current?.access_token) return;

    let cancelled = false;
    void (async () => {
      const result = await fetchMyCourses();
      if (cancelled) return;
      if (result.ok) {
        setState({ userId: current.user?.id ?? null, courses: result.data.courses });
        setFailed(false);
      } else {
        setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, attempt, sessionRef]);

  return {
    shelf: state.userId === userId ? state.courses : null,
    failed,
    reload: useCallback(() => setAttempt((value) => value + 1), []),
  };
}

export type TelegramReach = { linked: boolean; linkUrl: string | null };

/** Whether a course reminder can actually be delivered to this learner. */
export function useTelegramReach(session: Session | null) {
  const userId = session?.user?.id ?? null;
  const [state, setState] = useState<{ userId: string | null; reach: TelegramReach | null }>({
    userId: null,
    reach: null,
  });
  const sessionRef = useLatestSession(session);

  useEffect(() => {
    const current = sessionRef.current;
    if (!current?.access_token) return;

    let cancelled = false;
    void (async () => {
      try {
        const res = await readWithToken("/api/platform/users/me/telegram", current);
        if (cancelled || !res?.ok) return;
        setState({ userId: current.user?.id ?? null, reach: (await res.json()) as TelegramReach });
      } catch {
        // Non-fatal: the account section simply omits the reachability card.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, sessionRef]);

  return state.userId === userId ? state.reach : null;
}

export type AuthorProfileInput = {
  name: string;
  role?: string;
  bio?: string;
  quote?: string;
  credentials?: string[];
  facts?: string[];
  profileBlocks?: Author["profileBlocks"];
  experienceBadge?: string;
  achievementBadge?: string;
  consultation?: Author["consultation"];
  photo?: Author["photo"];
  background?: { src: string };
  listed?: boolean;
  slug?: string;
};

/**
 * The cabinet's author-profile fold: eligibility (does this account hold a
 * byline or a course to write one for), the draft itself, and a way to save
 * it. `eligible` decides whether `CabinetClient` renders the fold at all — a
 * learner who has never authored anything sees nothing here, not an empty
 * editor.
 */
export function useAuthorProfile(session: Session | null) {
  const userId = session?.user?.id ?? null;
  const [state, setState] = useState<{
    userId: string | null;
    eligible: boolean;
    author: Author | null;
  }>({ userId: null, eligible: false, author: null });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const sessionRef = useLatestSession(session);

  useEffect(() => {
    const current = sessionRef.current;
    if (!current?.access_token) return;

    let cancelled = false;
    void (async () => {
      const res = await readWithToken("/api/platform/users/me/author", current);
      if (cancelled || !res?.ok) return;
      const body = (await res.json()) as { eligible: boolean; author: Author | null };
      setState({ userId: current.user?.id ?? null, eligible: body.eligible, author: body.author });
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, sessionRef]);

  const save = useCallback(
    async (input: AuthorProfileInput): Promise<boolean> => {
      const current = sessionRef.current;
      if (!current?.access_token) return false;

      setSaving(true);
      setSaveError(null);
      try {
        const res = await readWithTokenPost("/api/platform/users/me/author", current, input);
        if (!res?.ok) {
          const body = (await res?.json().catch(() => null)) as { error?: string } | null;
          setSaveError(body?.error ?? "save_failed");
          return false;
        }
        const body = (await res.json()) as { author: Author };
        setState((prev) => ({ ...prev, userId: current.user?.id ?? null, eligible: true, author: body.author }));
        return true;
      } catch {
        setSaveError("save_failed");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [sessionRef]
  );

  const matches = state.userId === userId;
  return {
    eligible: matches ? state.eligible : false,
    author: matches ? state.author : null,
    loading: Boolean(session) && !matches,
    saving,
    saveError,
    save,
  };
}
