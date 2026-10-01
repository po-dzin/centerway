/**
 * How the platform tells an automated visitor from a person — for the ads, not
 * for the door. Policy: `docs/external-agents-policy-2026-10-01.md`, part 2.
 *
 * WHAT IT IS FOR. An agent may browse, take a test, leave a request and walk a
 * person to checkout; none of that is refused. What it must not do is look like
 * an ad-driven human to Meta: a browser agent on checkout sent InitiateCheckout
 * exactly as a buyer would, and the campaigns learn from that signal. So agent
 * traffic is treated the way `cw_staff=1` is — the Pixel stays unloaded, the
 * server-side CAPI jobs are not enqueued — and what it does is kept and marked
 * `via_agent` instead of being thrown away.
 *
 * WHAT IT IS NOT. Not a gate, and not proof. A self-declared signal can be
 * faked or omitted, and an assistant running inside a person's own browser
 * (an extension) is indistinguishable from that person — correctly so, it is
 * their session. A miss costs one noisy event in Meta; nothing here may ever
 * refuse a request.
 *
 * THREE SIGNALS, any one is enough:
 * - `Signature-Agent` — Web Bot Auth. Browser agents that sign their requests
 *   (OpenAI's agent does) send it on every request while their User-Agent is a
 *   plain Chrome. It is the only signal that catches them, and only the server
 *   sees it — hence the cookie.
 * - The User-Agent — crawlers and fetchers that name themselves, plus headless
 *   browsers.
 * - The `cw_agent` cookie — set by the proxy on the first request that showed
 *   either of the above, so the browser-side Pixel, which cannot read request
 *   headers, learns the same answer.
 *
 * Isomorphic on purpose: the proxy, the API routes and the client Pixel all
 * import it. `landing-pixel.js` carries a copy of the pattern — the landings are
 * static HTML and never load this bundle.
 */

export const AGENT_COOKIE = "cw_agent";

/**
 * Names, not a generic `bot|crawler|spider` catch-all: a broad pattern also
 * matches in-app browsers and accessibility tools that are real people.
 */
export const AGENT_USER_AGENT =
  /ChatGPT-User|OAI-SearchBot|GPTBot|Claude-User|Claude-SearchBot|ClaudeBot|Perplexity-User|PerplexityBot|Google-Extended|Googlebot|GoogleOther|bingbot|Applebot|meta-externalagent|meta-externalfetcher|Bytespider|CCBot|Amazonbot|DuckAssistBot|MistralAI-User|HeadlessChrome/i;

export function isAgentUserAgent(userAgent: string | null | undefined): boolean {
  return Boolean(userAgent && AGENT_USER_AGENT.test(userAgent));
}

type HeaderReader = { get(name: string): string | null };

/** The server's answer: request headers, plus the cookie when the caller has it. */
export function isAgentRequest(headers: HeaderReader, cookieValue?: string | null): boolean {
  if (cookieValue === "1") return true;
  if (headers.get("signature-agent")) return true;
  return isAgentUserAgent(headers.get("user-agent"));
}

/**
 * The browser's answer. `navigator.webdriver` is what an automation-driven
 * browser reports about itself — the agents and our own smoke runs alike, and
 * neither belongs in Meta.
 */
export function isAgentBrowser(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (navigator.webdriver) return true;
  } catch {
    /* fall through to the other two signals */
  }
  if (isAgentUserAgent(navigator.userAgent)) return true;
  return new RegExp(`(?:^|;\\s*)${AGENT_COOKIE}=1(?:;|$)`).test(document.cookie || "");
}
