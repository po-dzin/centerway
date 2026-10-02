import { headers } from "next/headers";

import { isPersonalHost } from "@/lib/platform/surfaceHref";
import { renderRobots } from "@/lib/seo/agentPolicy";

/**
 * A route handler, not `robots.ts`: Next's `MetadataRoute.Robots` has no field
 * for `Content-Signal`, and the policy needs it. What the file says lives in
 * `agentPolicy.ts`; this only picks the host.
 *
 * Reading the host makes this route dynamic. That is the point — it has to
 * answer differently per host — and it is one tiny response per crawl.
 */
export async function GET(): Promise<Response> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");

  return new Response(renderRobots({ personal: isPersonalHost(host) }), {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
