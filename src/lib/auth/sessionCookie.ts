/**
 * Where the browser session is stored, and who can read it.
 *
 * WHY IT MOVED OFF `localStorage`. The builder lives on its own host, and the
 * learner's surfaces will follow it to `my.centerway.net.ua`. `localStorage` is
 * per-ORIGIN, so with it an author signs in twice — once on the platform and
 * again on the builder — and the app switcher cannot switch, only offer a
 * second login. The claim in `docs/lms-builder-2026-08-21.md` that a separate
 * host COSTS a separate session was true of the configuration, not of the web:
 * `www.` and `my.` are both under `.centerway.net.ua`, and a cookie scoped to
 * the parent domain is shared by all of them.
 *
 * WHAT IT COSTS, stated plainly. A cookie cannot be scoped to two chosen
 * subdomains — it is the parent domain or nothing. So the session also travels
 * to the five funnel landing hosts (`way21.`, `reset-day.`, `dosha.`, …), and
 * it cannot be `HttpOnly`, because supabase-js has to read it. Those landings
 * run Meta Pixel and Microsoft Clarity, so third-party script on those hosts
 * can reach the token. The same two scripts already run on the platform origin,
 * where they can read `localStorage` just as freely — the change is the landing
 * hosts, not the vendors. The alternative that avoids it is an explicit
 * one-time handoff between origins (§4B of the routing contract), which is more
 * machinery for the same result.
 *
 * PURE. The host is passed in, so the rule is testable without a browser.
 */

/** The registrable domain every CenterWay surface lives under. */
export const SESSION_COOKIE_DOMAIN = ".centerway.net.ua";

export type SessionCookieOptions = {
  /** Absent means host-only — the cookie stays on the origin that set it. */
  domain?: string;
  path: string;
  sameSite: "lax";
  secure: boolean;
};

function normalizeHost(host: string | null | undefined): string {
  if (!host) return "";
  return host.split(":")[0].trim().toLowerCase();
}

/**
 * True only for the real domain and its subdomains.
 *
 * Anchored on the dot so `centerway.net.ua.evil.com` cannot claim it — a host
 * suffix test written as `endsWith("centerway.net.ua")` would hand the session
 * scope to anyone who registers a name ending that way.
 */
export function isPlatformDomain(host: string | null | undefined): boolean {
  const value = normalizeHost(host);
  return value === "centerway.net.ua" || value.endsWith(".centerway.net.ua");
}

/**
 * Cookie attributes for this host.
 *
 * Off the real domain — localhost, and every `*.vercel.app` preview — the
 * cookie stays host-only. Sharing across preview deployments would be both
 * impossible (`vercel.app` is a public suffix, so browsers refuse a cookie
 * scoped to it) and wrong, since two previews are two different builds.
 *
 * `secure` follows the scheme rather than being hardcoded: a Secure cookie is
 * silently dropped over plain http, which on localhost would look exactly like
 * "sign-in does nothing".
 */
export function sessionCookieOptions(
  host: string | null | undefined,
  protocol: string = "https:",
): SessionCookieOptions {
  const onPlatform = isPlatformDomain(host);
  return {
    ...(onPlatform ? { domain: SESSION_COOKIE_DOMAIN } : {}),
    path: "/",
    /* `lax`, not `strict`: the OAuth provider redirects back to us as a
       top-level navigation from another site, and a strict cookie is withheld
       on exactly that hop. */
    sameSite: "lax",
    secure: protocol === "https:",
  };
}

/**
 * The `localStorage` key supabase-js used before this change.
 *
 * Derived the same way the library derives it — the first label of the project
 * URL's host — so an account signed in before the switch can be carried over
 * instead of being silently logged out.
 */
export function legacySessionStorageKey(supabaseUrl: string): string | null {
  try {
    const ref = new URL(supabaseUrl).hostname.split(".")[0];
    return ref ? `sb-${ref}-auth-token` : null;
  } catch {
    return null;
  }
}
