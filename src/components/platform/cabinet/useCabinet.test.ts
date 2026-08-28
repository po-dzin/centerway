/**
 * The session-identity rule the cabinet's reads are keyed on.
 *
 * `sameSession` is what stops supabase-js's repeated announcements of one
 * session — `getSession()`, then INITIAL_SESSION, then SIGNED_IN, each a fresh
 * object — from reaching state as three different sessions. The two cases that
 * MUST stay distinguishable are the two it would be dangerous to collapse: a
 * different account, and no account at all.
 */

import { describe, expect, it } from "vitest";
import type { Session } from "@supabase/supabase-js";

import { sameSession } from "./useCabinet";

function session(userId: string, accessToken: string): Session {
  return { access_token: accessToken, user: { id: userId } } as Session;
}

describe("sameSession", () => {
  it("treats a re-announced session as the same one", () => {
    expect(sameSession(session("u1", "t1"), session("u1", "t1"))).toBe(true);
  });

  it("treats the identical object as the same one", () => {
    const only = session("u1", "t1");
    expect(sameSession(only, only)).toBe(true);
  });

  it("separates a different account", () => {
    expect(sameSession(session("u1", "t1"), session("u2", "t1"))).toBe(false);
  });

  it("separates a refreshed token", () => {
    expect(sameSession(session("u1", "t1"), session("u1", "t2"))).toBe(false);
  });

  it("separates signing in and signing out", () => {
    expect(sameSession(null, session("u1", "t1"))).toBe(false);
    expect(sameSession(session("u1", "t1"), null)).toBe(false);
  });

  it("treats two signed-out states as the same", () => {
    expect(sameSession(null, null)).toBe(true);
  });
});
