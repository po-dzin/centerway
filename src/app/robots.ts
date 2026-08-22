import type { MetadataRoute } from "next";
import { headers } from "next/headers";

import { isPersonalHost } from "@/lib/platform/surfaceHref";

/**
 * Two hosts, two answers.
 *
 * `www` is the showcase and is meant to be indexed. `my` is somebody's own
 * shelf, player and builder: nothing there is addressed to a stranger, and
 * everything there needs a session, so a crawler finds either a sign-in wall or
 * a duplicate of a public page. One rule for the whole host, rather than
 * `robots: { index: false }` repeated per route and forgotten on the next one.
 *
 * Reading the host makes this route dynamic. That is the point — it has to
 * answer differently per host — and it is one tiny response per crawl.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");

  if (isPersonalHost(host)) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: "https://www.centerway.net.ua/sitemap.xml",
  };
}
