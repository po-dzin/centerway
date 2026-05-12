import { getFunnelHostUrl } from "@/lib/surfaces/catalog";

export const DOSHA_PRIMARY_EXIT = {
  productKey: "consult",
  href: getFunnelHostUrl("consult") ?? "/consult",
  target: "consult",
  ctaTarget: "consult",
  nextStep: "consult",
} as const;

export const DOSHA_SECONDARY_EXIT = {
  productKey: "detox",
  href: getFunnelHostUrl("detox") ?? "/detox",
  target: "detox",
  ctaTarget: "detox",
  nextStep: "detox",
} as const;
