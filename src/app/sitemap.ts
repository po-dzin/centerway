import type { MetadataRoute } from "next";

import { listStorefrontCourses } from "@/lib/platform/offers";
import { getMainDomainSitemapRoutes } from "@/lib/surfaces/catalog";
import { PLATFORM_ORIGIN } from "@/lib/surfaces/catalog";

/**
 * What `www` offers a crawler.
 *
 * TWO SOURCES, and that is the change. The static list is the hand-written
 * tree; the second half is every course an author published as `listed`. While
 * this file listed only the first, a course out of the builder had a real
 * public offer page at `/programs/<slug>` that appeared in no sitemap at all —
 * the storefront could show it and a crawler had no way to learn it exists.
 *
 * A course that is `unlisted` stays out on purpose: its page carries
 * `robots: noindex`, and listing it here would ask for exactly the indexing the
 * setting refuses. `listStorefrontCourses` already filters to `listed`.
 *
 * `listStorefrontCourses` never throws — a database that is down yields the
 * static tree rather than a broken sitemap.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes = getMainDomainSitemapRoutes().map((route) => ({
    url: `${PLATFORM_ORIGIN}${route}`,
    lastModified: now,
    changeFrequency: (route === "/" ? "weekly" : "monthly") as "weekly" | "monthly",
    priority: route === "/" ? 1 : 0.7,
  }));

  const courses = await listStorefrontCourses();
  const known = new Set(staticRoutes.map((entry) => entry.url));

  const courseRoutes = courses
    .map((course) => `${PLATFORM_ORIGIN}/programs/${course.slug}`)
    // A builder course may share a slug with a hand-written page, and the
    // static route wins in the router — so it must not appear twice here.
    .filter((url) => !known.has(url))
    .map((url) => ({
      url,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

  return [...staticRoutes, ...courseRoutes];
}
