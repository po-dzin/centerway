import type { NextRequest, NextResponse } from "next/server";

import { cookieDomain } from "@/lib/referral/attribution";
import { AGENT_COOKIE, isAgentRequest } from "@/lib/tracking/agentTraffic";

/**
 * Hands the server's verdict to the browser. The Pixel runs in the page and
 * cannot see `Signature-Agent`, which is the only thing that gives a signed
 * browser agent away; the proxy can, so it leaves `cw_agent=1` for the Pixel
 * and for every later API call to read.
 *
 * A session cookie, readable by script (that is its job), set once: a request
 * that already carries it, or shows no signal, leaves the response untouched.
 * It only ever silences ad tracking — see `lib/tracking/agentTraffic`.
 */
export function rememberAgent<R extends NextResponse>(req: NextRequest, res: R): R {
  if (req.cookies.get(AGENT_COOKIE)?.value === "1") return res;
  if (!isAgentRequest(req.headers)) return res;
  const domain = cookieDomain(req);
  res.cookies.set(AGENT_COOKIE, "1", {
    path: "/",
    sameSite: "lax",
    secure: domain !== undefined,
    ...(domain ? { domain } : {}),
  });
  return res;
}
