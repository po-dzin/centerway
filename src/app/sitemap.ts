import type { MetadataRoute } from "next";
import { getMainDomainSitemapRoutes } from "@/lib/surfaces/catalog";

const BASE_URL = "https://www.centerway.net.ua";
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return getMainDomainSitemapRoutes().map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: now,
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : 0.7,
  }));
}
