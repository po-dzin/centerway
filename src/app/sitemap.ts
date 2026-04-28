import type { MetadataRoute } from "next";

const BASE_URL = "https://www.centerway.net.ua";

const routes = [
  "/",
  "/expert",
  "/programs/way21",
  "/programs/ideal-body",
  "/programs/irem",
  "/mini-detox",
  "/legal/public-offer",
  "/legal/privacy",
  "/dosha-test",
  "/reboot",
  "/irem",
  "/detox",
  "/herbs",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return routes.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: now,
    changeFrequency: route === "/" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : 0.7,
  }));
}
