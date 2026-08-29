/**
 * The platform's own origin, server-safe.
 *
 * Declared here, not in a `"use client"` module: anything running on the server
 * — the Telegram bot, reminders, emails — has to be able to import the origin,
 * and a client module would have forced a second copy of the domain.
 */
export const PLATFORM_ORIGIN = "https://www.centerway.net.ua";

/**
 * The host every PERSONAL surface lives on: the learner's shelf, the player,
 * and the builder.
 *
 * The line is not "showcase against learning" — it is PUBLIC against PERSONAL.
 * `www` stays anonymous, indexable and cacheable; nothing there needs a
 * session. Everything that answers "what is MINE" answers from here.
 *
 * The old reason for the builder's separate host — "a separate origin costs a
 * separate session" — was true of the configuration, not of the web: the
 * session now lives in a cookie on `.centerway.net.ua` and is shared by every
 * surface under it (`src/lib/auth/sessionCookie.ts`). What a separate origin
 * still costs is one entry in the Supabase auth redirect allowlist, and the
 * PWA scope, which is why the installed app now lives HERE rather than on the
 * showcase.
 */
export const PERSONAL_HOST = "my.centerway.net.ua";

/** The personal host's own origin, server-safe. */
export const PERSONAL_ORIGIN = `https://${PERSONAL_HOST}`;

/**
 * The builder's prefix, which is a real public path: `my/build/…`.
 */
export const BUILDER_PATH_PREFIX = "/build";

/**
 * The learner routes' INTERNAL prefix.
 *
 * `/learn` is where the pages live in the router and nothing else. On the
 * personal host it is not part of any address: `my/` is the dashboard and
 * `my/way21/day-1` is a lesson, and the proxy rewrites those onto this prefix
 * the way the builder host used to rewrite onto `/build`.
 *
 * It survives as a prefix at all because on localhost and on preview there is
 * one origin for everything, and a lesson at `/way21/day-1` there would collide
 * with the funnel landing of the same name.
 */
export const LEARNING_PATH_PREFIX = "/learn";

/**
 * The cabinet's prefix, a real address on the personal host: `my/profile`.
 *
 * MOVED HERE 2026-08-27, and the earlier decision is worth stating because it
 * was deliberate: `/profile` lived on `www` as "the crossing" — the step
 * between the public platform and the library, on the origin someone arrives
 * at. What that missed is where the cabinet is actually USED. It is the screen
 * a learner opens to resume a course, the one the installed app should open at,
 * and the only page that links to both the library and the Майстерня — all of
 * which are on `my`. Leaving it on `www` meant the personal app's home page was
 * on the public origin, one redirect away from everything it points at.
 *
 * It keeps its segment, like `/build` and unlike the learner tree: `my/profile`
 * IS the address, not a container to be stripped.
 */
export const PROFILE_PATH_PREFIX = "/profile";

export const PERSONAL_PATH_PREFIXES = [
  LEARNING_PATH_PREFIX,
  BUILDER_PATH_PREFIX,
  PROFILE_PATH_PREFIX,
] as const;

/** True for a path owned by the personal host, prefix-exact. */
export function isPersonalPath(path: string): boolean {
  const pathname = path.split("?")[0].split("#")[0];
  return PERSONAL_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * The PUBLIC form of a personal path, as it is addressed on `my`.
 *
 * The learner tree loses its prefix entirely — `/learn` is the dashboard at the
 * root, `/learn/way21/day-1` is `/way21/day-1` — so the address someone shares,
 * bookmarks or installs is the same one the switcher and the player print. The
 * builder keeps `/build`, because there it is a real segment and not a
 * container: `my/build` IS the builder's own home.
 *
 * App code keeps writing `/learn/…`, which is the route the page lives at and,
 * on localhost and preview, also the address.
 */
export function canonicalPersonalPath(path: string): string {
  const [pathname, ...rest] = path.split(/(?=[?#])/);
  if (pathname !== LEARNING_PATH_PREFIX && !pathname.startsWith(`${LEARNING_PATH_PREFIX}/`)) {
    return path;
  }
  const stripped = pathname.slice(LEARNING_PATH_PREFIX.length) || "/";
  return `${stripped}${rest.join("")}`;
}

/**
 * Top-level segments that belong to the PUBLIC tree.
 *
 * On the personal host any unclaimed path is a COURSE — `my/way21/day-1` is a
 * lesson — so these names cannot also be course slugs, and a request for one on
 * `my` is somebody who typed or followed a public address into the wrong
 * origin. They forward to `www` rather than 404ing as a missing course.
 *
 * Note what is NOT here: `way21`, `reset-day`, `herbs` and the other funnel
 * slugs. They are public pages on `www`, and they are also the slugs of the
 * courses sold under them — which is exactly why the personal host must own
 * them and the public one must keep them.
 *
 * `catalog.test.ts` walks `src/app/(platform)` and fails if this list drifts
 * from the router.
 */
export const PUBLIC_ROOT_SEGMENTS = [
  "admin",
  "consult",
  "detox",
  "dosha-test",
  "expert",
  "experts",
  "legal",
  "mini-detox",
  "pay",
  "platform-vision",
  "products",
  "programs",
  "tests",
] as const;

export function isPublicRootPath(pathname: string): boolean {
  const segment = pathname.split("/")[1] ?? "";
  return (PUBLIC_ROOT_SEGMENTS as readonly string[]).includes(segment);
}

/**
 * The reverse: the ROUTE behind an address on the personal host.
 *
 * `/` and `/way21/day-1` are learner routes; `/build/…` is already one. Used by
 * the proxy, which is the only place that has to go this direction.
 */
export function personalRouteFor(pathname: string): string {
  /* The two prefixes that are addresses in their own right. Everything else on
     this host is a course, so it goes under the learner tree. */
  for (const prefix of [BUILDER_PATH_PREFIX, PROFILE_PATH_PREFIX]) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return pathname;
  }
  return pathname === "/" ? LEARNING_PATH_PREFIX : `${LEARNING_PATH_PREFIX}${pathname}`;
}

/** Absolute platform URL for a site-relative path, for use off-origin. */
export function platformUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${PLATFORM_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Absolute personal-host URL for a site-relative path, for use off-origin. */
export function personalUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${PERSONAL_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Absolute URL on whichever origin OWNS the path.
 *
 * For code with no host of its own — the support bot, lesson reminders, mail —
 * where a link has to be absolute and there is nothing to be relative to. It
 * used to be `platformUrl` everywhere, which after the split would send every
 * reminder to a 308 on the way to the lesson it names.
 */
export function surfaceUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return isPersonalPath(path) ? personalUrl(canonicalPersonalPath(path)) : platformUrl(path);
}

export type ProductKey =
  | "reboot"
  | "irem"
  | "detox"
  | "way21"
  | "reset-day"
  | "dosha"
  | "herbs"
  | "consult";
export type SurfaceKind = "funnel" | "platform" | "utility";
export type CtaMode = "lead" | "checkout" | "redirect";
export type FunnelRuntime = "landing-app" | "generated-app" | "disabled";

export type ProductSurfaceEntry = {
  productKey: ProductKey;
  surfaceKinds: SurfaceKind[];
  host: string | null;
  platformRoute: string | null;
  ctaMode: CtaMode;
  defaultDoshaEligibility: "primary" | "secondary" | "none";
  status: "active" | "planned" | "disabled";
  funnelRuntime: FunnelRuntime;
  internalFunnelRoute: string | null;
  legacyAliases?: string[];
};

const PRODUCT_SURFACE_REGISTRY: Record<ProductKey, ProductSurfaceEntry> = {
  reboot: {
    productKey: "reboot",
    surfaceKinds: ["funnel", "platform"],
    host: "reboot.centerway.net.ua",
    platformRoute: "/programs/reboot",
    ctaMode: "checkout",
    defaultDoshaEligibility: "none",
    status: "active",
    funnelRuntime: "landing-app",
    internalFunnelRoute: "/reboot",
    legacyAliases: ["short", "reboot"],
  },
  irem: {
    productKey: "irem",
    surfaceKinds: ["funnel", "platform"],
    host: "irem.centerway.net.ua",
    platformRoute: "/programs/irem",
    ctaMode: "checkout",
    defaultDoshaEligibility: "none",
    status: "active",
    funnelRuntime: "landing-app",
    internalFunnelRoute: "/irem",
  },
  detox: {
    productKey: "detox",
    surfaceKinds: ["platform"],
    host: null,
    platformRoute: "/programs/way21",
    ctaMode: "lead",
    defaultDoshaEligibility: "secondary",
    status: "disabled",
    funnelRuntime: "disabled",
    internalFunnelRoute: null,
  },
  way21: {
    productKey: "way21",
    surfaceKinds: ["funnel"],
    host: "way21.centerway.net.ua",
    platformRoute: "/programs/way21",
    ctaMode: "checkout",
    defaultDoshaEligibility: "none",
    status: "active",
    funnelRuntime: "landing-app",
    internalFunnelRoute: "/way21",
    legacyAliases: ["way21", "shlyah21", "detox", "detox21"],
  },
  "reset-day": {
    productKey: "reset-day",
    surfaceKinds: ["funnel", "platform"],
    host: "resetday.centerway.net.ua",
    // Absorbed the retired "mini-detox" surface (2026-08-17). That entry was a
    // disabled duplicate of this product under its old name, and "mini-detox"
    // was already listed below as a legacy alias — so the route moves here
    // rather than living on a second key for the same thing.
    platformRoute: "/programs/reset-day",
    ctaMode: "checkout",
    defaultDoshaEligibility: "none",
    status: "active",
    funnelRuntime: "landing-app",
    internalFunnelRoute: "/reset-day",
    legacyAliases: ["reset-day", "resetday", "rozvantazhennya", "mini-detox", "mini_detox", "reset"],
  },
  dosha: {
    productKey: "dosha",
    surfaceKinds: ["funnel", "platform"],
    host: "dosha.centerway.net.ua",
    platformRoute: "/tests/dosha",
    ctaMode: "redirect",
    defaultDoshaEligibility: "none",
    status: "active",
    funnelRuntime: "landing-app",
    internalFunnelRoute: "/tests/dosha",
    legacyAliases: ["dosha", "dosha-test"],
  },
  herbs: {
    productKey: "herbs",
    surfaceKinds: ["funnel", "platform"],
    host: "herbs.centerway.net.ua",
    platformRoute: "/products/herbs",
    // Was "redirect" while the landing's only CTA was a lead form. The funnel
    // now sells the blend directly, so the CTA is a checkout like way21's.
    ctaMode: "checkout",
    defaultDoshaEligibility: "secondary",
    status: "active",
    funnelRuntime: "landing-app",
    // Route handler at src/app/herbs/route.ts, same as way21 and reset-day.
    // Was "/herbs/index.html" while /herbs redirected to the catalogue page.
    internalFunnelRoute: "/herbs",
  },
  consult: {
    productKey: "consult",
    surfaceKinds: ["funnel", "platform"],
    host: "consult.centerway.net.ua",
    platformRoute: "/consult",
    ctaMode: "lead",
    defaultDoshaEligibility: "primary",
    status: "active",
    funnelRuntime: "landing-app",
    internalFunnelRoute: "/consult/index.html",
  },
};

const HOST_TO_PRODUCT = new Map<string, ProductKey>();
const ALIAS_TO_PRODUCT = new Map<string, ProductKey>();

for (const entry of Object.values(PRODUCT_SURFACE_REGISTRY)) {
  if (!entry.host) continue;
  HOST_TO_PRODUCT.set(entry.host, entry.productKey);
  HOST_TO_PRODUCT.set(`www.${entry.host}`, entry.productKey);
}

for (const entry of Object.values(PRODUCT_SURFACE_REGISTRY)) {
  if (entry.status === "active") {
    ALIAS_TO_PRODUCT.set(entry.productKey, entry.productKey);
  }
  for (const alias of entry.legacyAliases ?? []) {
    ALIAS_TO_PRODUCT.set(alias, entry.productKey);
  }
}

function normalizeHost(raw: string | null): string {
  if (!raw) return "";
  return raw.split(":")[0].trim().toLowerCase();
}

export function getProductSurfaceRegistry() {
  return PRODUCT_SURFACE_REGISTRY;
}

export function getProductSurfaceEntry(productKey: ProductKey): ProductSurfaceEntry {
  return PRODUCT_SURFACE_REGISTRY[productKey];
}

export function getProductKeyByAlias(input: string | null | undefined): ProductKey | null {
  if (!input) return null;
  const normalized = input.trim().toLowerCase();
  return ALIAS_TO_PRODUCT.get(normalized) ?? null;
}

export function getProductByHost(rawHost: string | null): ProductKey | null {
  return HOST_TO_PRODUCT.get(normalizeHost(rawHost)) ?? null;
}

export function isActiveFunnelProduct(productKey: ProductKey): boolean {
  const entry = getProductSurfaceEntry(productKey);
  return entry.surfaceKinds.includes("funnel") && entry.status === "active" && entry.funnelRuntime !== "disabled";
}

export function getFunnelHostUrl(productKey: ProductKey): string | null {
  const host = getProductSurfaceEntry(productKey).host;
  return host ? `https://${host}/` : null;
}

export function getPlatformRoute(productKey: ProductKey): string | null {
  return getProductSurfaceEntry(productKey).platformRoute;
}

export function getMainDomainSitemapRoutes(): string[] {
  return [
    "/",
    "/programs",
    "/products",
    /* `/expert` is deliberately absent since the 2026-08-23 merge — it 308s to
       `/consult`, and a sitemap that lists a redirect asks every crawler to
       spend a fetch discovering that. `/consult` below is the surviving page. */
    "/programs/reboot",
    // Was missing while the page existed, was linked from the catalogue and
    // sold a product — the one hand-written offer no crawler was told about.
    "/programs/reset-day",
    "/programs/way21",
    "/products/herbs",
    "/programs/ideal-body",
    "/programs/irem",
    "/consult",
    "/tests",
    "/tests/dosha",
    "/legal/public-offer",
    "/legal/privacy",
  ];
}
