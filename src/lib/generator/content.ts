import funnelContentJson from "../../../data/generator/funnel_content.json";

export type FunnelRouteKey = "consult" | "detox" | "herbs";
export type EthnoIconName = "seed" | "spiral" | "hands" | "leaf" | "person";

export type RouteCard = {
  title: string;
  text: string;
  icon: EthnoIconName;
};

export type StageItem = {
  label: string;
  icon: EthnoIconName;
};

export type OfferIncludeCluster = {
  title: string;
  icon: EthnoIconName;
  items: string[];
};

export type RouteMapItem = {
  phase: string;
  title: string;
  text: string;
  icon: EthnoIconName;
  status?: "done" | "active" | "next";
};

export type RouteLink = {
  title: string;
  text: string;
  href: string;
  ctaLabel: string;
};

export type RouteContent = {
  eyebrow: string;
  title: string;
  lead: string;
  routeTitle: string;
  heroHighlights: string[];
  routeCards: RouteCard[];
  routeMapTitle: string;
  routeMapLead: string;
  routeMap: RouteMapItem[];
  nextBestRoute: RouteLink;
  resourceEntry: RouteLink;
  offerDefinition: { title: string; text: string };
  offerIncludes: string[];
  offerIncludeClusters: OfferIncludeCluster[];
  priceLabel: string;
  priceValue: number;
  howItWorks: Array<{ title: string; text: string }>;
  stageBreakdown: StageItem[];
  proof: Array<{ title: string; text: string }>;
  boundary: string[];
  nextStepTitle: string;
  nextStepText: string;
  nextStepChecklist: string[];
  quote?: { text: string; author: string };
  footerLabel: string;
};

export type FunnelContentManifest = {
  schema_version: string;
  content: Record<FunnelRouteKey, RouteContent>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function validateRouteContent(route: string, value: unknown): asserts value is RouteContent {
  assert(isRecord(value), `funnel_content_invalid_route:${route}`);
  assert(isNonEmptyString(value.eyebrow), `funnel_content_missing_eyebrow:${route}`);
  assert(isNonEmptyString(value.title), `funnel_content_missing_title:${route}`);
  assert(isNonEmptyString(value.lead), `funnel_content_missing_lead:${route}`);
  assert(Array.isArray(value.heroHighlights) && value.heroHighlights.every(isNonEmptyString), `funnel_content_invalid_hero_highlights:${route}`);
  assert(Array.isArray(value.routeCards) && value.routeCards.length > 0, `funnel_content_invalid_route_cards:${route}`);
  assert(Array.isArray(value.howItWorks) && value.howItWorks.length > 0, `funnel_content_invalid_how_it_works:${route}`);
  assert(Array.isArray(value.stageBreakdown) && value.stageBreakdown.length > 0, `funnel_content_invalid_stage_breakdown:${route}`);
  assert(Array.isArray(value.proof) && value.proof.length > 0, `funnel_content_invalid_proof:${route}`);
  assert(Array.isArray(value.boundary) && value.boundary.length > 0, `funnel_content_invalid_boundary:${route}`);
  assert(Array.isArray(value.nextStepChecklist) && value.nextStepChecklist.length > 0, `funnel_content_invalid_next_step:${route}`);
  assert(isRecord(value.nextBestRoute) && isNonEmptyString(value.nextBestRoute.title), `funnel_content_invalid_next_best_route:${route}`);
  assert(isRecord(value.resourceEntry) && isNonEmptyString(value.resourceEntry.title), `funnel_content_invalid_resource_entry:${route}`);
}

function validateManifest(input: unknown): FunnelContentManifest {
  assert(isRecord(input), "funnel_content_invalid_shape");
  assert(isNonEmptyString(input.schema_version), "funnel_content_schema_missing");
  assert(isRecord(input.content), "funnel_content_missing_content");

  const requiredRoutes: FunnelRouteKey[] = ["consult", "detox", "herbs"];
  for (const route of requiredRoutes) {
    validateRouteContent(route, input.content[route]);
  }

  return input as FunnelContentManifest;
}

const funnelContent = validateManifest(funnelContentJson as unknown);

export function getFunnelContent(route: FunnelRouteKey): RouteContent {
  return funnelContent.content[route];
}

export function getFunnelContentManifest(): FunnelContentManifest {
  return funnelContent;
}
