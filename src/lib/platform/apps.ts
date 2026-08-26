/**
 * The applications one account may hold, in one list.
 *
 * WHY THIS EXISTS. CenterWay runs three shells — the platform, the builder and
 * the admin panel — and until now none of them could reach another. The admin
 * shell had NO link out at all: the only control that left `/admin` was
 * `signOut()`, so leaving the panel meant leaving the account. The builder had
 * no account affordance whatsoever. The platform's own entry was a bare link to
 * `/profile`.
 *
 * The fix is not a back-link per shell — three back-links drift the moment a
 * fourth surface appears. It is one QUESTION answered once: which applications
 * may this person enter? Every shell renders the same answer; only the skin
 * differs, because the admin panel runs its own grey Tailwind theme and pulling
 * `--ds-*` into it is the cross-layer consumption `guard:ds-contract` bans. So
 * this module carries the DATA and each shell brings its own markup.
 *
 * PURE. No React, no DOM, no fetch — the host is passed in, so the same list is
 * computable on the server, in a test, and in three different renderers.
 */

import { BUILDER_PATH_PREFIX, PERSONAL_HOST } from "@/lib/surfaces/catalog";
import { isPersonalHost, resolveSurfaceHref, servesEveryPath } from "./surfaceHref";
import { LEARNING_SHELF_HREF } from "./content";
import { isAdminRole } from "./adminRole";

export type PlatformAppKey = "cabinet" | "learn" | "builder" | "admin";

export type PlatformApp = {
  key: PlatformAppKey;
  label: string;
  /** Path on the application's OWN origin. Resolve with `appHref`. */
  path: string;
  /** The host this application lives on; null means the platform origin. */
  host: string | null;
};

export type AppAudience = {
  signedIn: boolean;
  /** From `user_roles`, or null while unresolved. */
  role: string | null;
  /** Whether this account owns at least one `lms_courses` row. */
  authorsCourses: boolean;
};

/**
 * The profile is first, and the panel last.
 *
 * This is an ACCOUNT control, and the row that opens under an avatar should be
 * the account it belongs to — that is what the reader came to the avatar to
 * check. The shelf led for a while on the argument that the installed app opens
 * on it, which is true and is exactly why it does not need this row: someone
 * already on `my` reached the shelf by opening the app, and the bar above names
 * it again. The panel stays last because the people who can open it are the
 * ones who least need it advertised.
 *
 * «Профіль», not «Кабінет». The page says «Профіль» in its own header and the
 * signed-out control has always said it too — a menu row is not the place to
 * introduce a third word for one destination.
 */
const CABINET: PlatformApp = { key: "cabinet", label: "Профіль", path: "/profile", host: null };
const LEARN: PlatformApp = { key: "learn", label: "Бібліотека", path: LEARNING_SHELF_HREF, host: PERSONAL_HOST };
const BUILDER: PlatformApp = { key: "builder", label: "Білдер", path: BUILDER_PATH_PREFIX, host: PERSONAL_HOST };
const ADMIN: PlatformApp = { key: "admin", label: "Адмінка", path: "/admin", host: null };

/**
 * Which applications to offer.
 *
 * Signed out, none: the switcher is an account control and there is no account.
 *
 * The learning entry gates on SIGNED IN rather than "owns a course", matching
 * the header's standing rule that it does not fetch per page — an empty shelf
 * is a working destination, and a shelf that appears only after a round trip
 * would blink in on every navigation.
 *
 * The builder gates on either an admin role or owning a course row, because
 * ownership is per row (`lms_courses.author_id`) and a global "author" role
 * would say "may edit courses" rather than "may edit THESE courses" — the
 * distinction `builderAccess.ts` was built around. Today no non-admin author
 * exists, so in practice this is the admin term; the other one is what stops
 * the first external author from being locked out of their own tool.
 */
export function appsFor(audience: AppAudience): PlatformApp[] {
  if (!audience.signedIn) return [];

  const apps: PlatformApp[] = [CABINET, LEARN];
  if (audience.authorsCourses || isAdminRole(audience.role)) apps.push(BUILDER);
  if (isAdminRole(audience.role)) apps.push(ADMIN);
  return apps;
}

/**
 * Hosts where the personal applications are reachable by PATH rather than on
 * their own origin.
 *
 * The subdomain can only ever point at production, so on localhost and on a
 * preview deployment there is no personal host to be on — and treating those
 * prefixes as unreachable there would make the shelf and the builder the two
 * parts of the app that cannot be opened before they ship.
 *
 * This is the predicate `src/lib/proxy/personal.ts` enforces, lifted out of the
 * request so the switcher can ask the same question without a `NextRequest`.
 * Two copies of "where does this application live" is how a menu comes to offer
 * a link the router then 404s.
 */
export { isPersonalHost, servesEveryPath as hostServesPersonalPath };

/**
 * Where this application actually is, seen from `currentHost`.
 *
 * Cross-origin links are ABSOLUTE and same-origin links are RELATIVE, which is
 * what keeps a client-side navigation client-side. Getting this backwards is
 * how the builder would come to full-page-reload its own routes.
 *
 * The whole answer is `resolveSurfaceHref`: an application's home is a path,
 * and which origin owns a path is one question with one answer, asked here and
 * by every link in the shells.
 */
export function appHref(app: PlatformApp, currentHost: string | null | undefined): string {
  return resolveSurfaceHref(app.path, currentHost);
}

/** True when following this link leaves the current origin. */
export function appIsOffOrigin(app: PlatformApp, currentHost: string | null | undefined): boolean {
  return appHref(app, currentHost).startsWith("http");
}

/**
 * Which application the reader is inside right now, or null on a public page.
 *
 * The switcher marks it rather than hiding it. A menu whose contents change
 * shape depending on where you opened it is a menu you have to re-read every
 * time; one that always lists the same four rows and marks one is a map.
 *
 * The personal host's ROOT is the shelf — it is the installed app's start_url,
 * rewritten to `/learn` rather than redirected — so `/` there is "learn" and
 * not "no application".
 */
export function currentAppKey(
  host: string | null | undefined,
  pathname: string | null | undefined,
): PlatformAppKey | null {
  const path = (pathname ?? "").split("?")[0];
  if (isPersonalHost(host) && (path === "/" || path === "")) return "learn";

  const inside = (prefix: string) => path === prefix || path.startsWith(`${prefix}/`);

  if (inside(BUILDER_PATH_PREFIX)) return "builder";
  if (inside("/admin")) return "admin";
  if (inside(LEARNING_SHELF_HREF)) return "learn";
  if (inside("/profile")) return "cabinet";
  return null;
}
