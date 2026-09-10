import { authorizedFetch } from "@/components/auth/authorizedFetch";

/**
 * The dosha test's seven endpoints, as functions.
 *
 * They were seven inline `fetch` calls inside a 1,072-line component, three
 * of them building a Bearer header by hand from a session the component
 * subscribed to itself. `authorizedFetch` attaches the token when there is
 * one and nothing when there is not — the API accepts anonymous attempts —
 * so the callers no longer carry a session at all.
 */

export type TestOption = {
  id: string;
  order: number;
  code: string;
  text: string;
};

export type TestQuestion = {
  id: string;
  orderIndex: number;
  code: string;
  text: string;
  options: TestOption[];
};

export type TestDefinitionResponse = {
  testId: string;
  testVersion: string;
  totalQuestions: number;
  questions: TestQuestion[];
  sessionId?: string;
};

async function readJson<T>(response: Response): Promise<T | null> {
  const data = (await response.json().catch(() => ({ error: "invalid_json" }))) as T | { error: string };
  if (!response.ok || (data && typeof data === "object" && "error" in data)) return null;
  return data as T;
}

/** The questions for this session — the session id seeds the answer order, so it travels with the request. Retries once, then falls back to starting an attempt. */
export async function loadDefinition(sessionId: string): Promise<TestDefinitionResponse | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await fetch(`/api/tests/dosha-test?sessionId=${encodeURIComponent(sessionId)}`, {
        cache: "no-store",
        headers: { "Cache-Control": "no-store" },
      });
      const data = await readJson<TestDefinitionResponse>(res);
      if (data) return data;
    } catch {
      // Retry once before fallback.
    }
  }
  try {
    const res = await fetch("/api/tests/dosha-test/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: "dosha_test_route_fallback_start", sessionId }),
    });
    return await readJson<TestDefinitionResponse>(res);
  } catch {
    return null;
  }
}

export async function completeAttempt(input: { sessionId: string; answers: Array<{ questionId: string; optionId: string | null }> }): Promise<Response> {
  return authorizedFetch("/api/tests/dosha-test/complete", {
    method: "POST",
    body: JSON.stringify({ source: "dosha_test_route", sessionId: input.sessionId, answers: input.answers }),
  });
}

/** Hands an anonymous attempt to the account that just signed in. */
export async function attachAttempt(attemptId: string): Promise<Response | null> {
  return authorizedFetch(`/api/test-attempts/${attemptId}/attach`, { method: "POST" }).catch(() => null);
}

export async function requestTelegramLink(attemptId: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/test-attempts/${attemptId}/telegram`, { method: "POST" });
    if (!res.ok) return null;
    const data = (await res.json()) as { linkUrl?: string | null } | null;
    return data?.linkUrl ?? null;
  } catch {
    return null;
  }
}

export async function postAttemptEvent(attemptId: string, body: Record<string, unknown>): Promise<void> {
  await fetch(`/api/test-attempts/${attemptId}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => undefined);
}

/** Mirrors the signed-in account into platform_users. Best effort. */
export async function syncPlatformUser(): Promise<void> {
  await authorizedFetch("/api/platform/users/sync", { method: "POST" }).catch(() => undefined);
}
