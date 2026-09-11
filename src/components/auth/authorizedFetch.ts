import { supabaseClient } from "@/lib/supabaseClient";

/**
 * `fetch`, with the signed-in account's Bearer token on it.
 *
 * Twenty-three call sites used to read the session and write the header
 * themselves, in four spellings. Two of them also retried once after a 401
 * with a refreshed token, because a token that expired between restore and
 * the first read answers 401 exactly once, and "could not load" to a person
 * whose session is perfectly valid is the wrong answer. Every call gets that
 * retry now.
 *
 * A string body is JSON and says so; any other body (FormData) keeps the
 * browser's own content-type, boundary and all.
 */
export async function accessToken(): Promise<string | null> {
  const { data } = await supabaseClient.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function authorizedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = await accessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (typeof init.body === "string" && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  let response = await fetch(input, { ...init, headers });

  if (response.status === 401 && token) {
    const { data } = await supabaseClient.auth.refreshSession();
    const fresh = data.session?.access_token;
    if (fresh && fresh !== token) {
      headers.set("Authorization", `Bearer ${fresh}`);
      response = await fetch(input, { ...init, headers });
    }
  }

  return response;
}

/**
 * `authorizedFetch` for a JSON endpoint: the parsed payload, or a thrown
 * Error carrying the envelope's `error` code (the status when there is none).
 * The shape four admin surfaces each wrote as their own `authFetch`.
 */
export async function authorizedJson<T = unknown>(input: RequestInfo | URL, init: RequestInit = {}): Promise<T> {
  const response = await authorizedFetch(input, init);
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) throw new Error(String(payload?.error ?? response.status));
  return payload;
}
