import { getFunnelHostUrl } from "@/lib/surfaces/catalog";

export const DOSHA_PRIMARY_EXIT = {
  productKey: "consult",
  href: getFunnelHostUrl("consult") ?? "/consult",
  target: "consult",
  ctaTarget: "consult",
  nextStep: "consult",
} as const;

export const DOSHA_SECONDARY_EXIT = {
  productKey: "way21",
  href: getFunnelHostUrl("way21") ?? "/way21",
  target: "way21",
  ctaTarget: "way21",
  nextStep: "way21",
} as const;
