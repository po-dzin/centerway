/**
 * WHO BROUGHT THIS PERSON (2026-09-19).
 *
 * `?ref=olena` on any link into the platform. It is a PERSON's tag, which is
 * why it is not a UTM: `utm_campaign` names a campaign the owner runs and
 * reports on in Meta; `ref` names a friend who shared a link, and the only
 * report it feeds is that friend's own «по вашому посиланню прийшли N».
 *
 * WHERE IT LANDS. On the enrollment, for a free sign-up — a free marathon has
 * no order to carry it. On the order as well, when the person pays. The first
 * answer stands: someone who came through Olena's link in September is Olena's,
 * even if they click Taras's link in October.
 *
 * The shape is narrow on purpose (`orders_ref_shape`, `lms_enrollments_ref_shape`
 * in the database say the same): it is typed into URLs by hand and read aloud,
 * and anything that is not a plain lowercase tag is more likely an injection
 * attempt than a friend's name.
 */

export const REF_PARAM = "ref";
export const REF_COOKIE = "cw_ref";
/** Ninety days: a marathon is announced weeks before it starts. */
export const REF_COOKIE_MAX_AGE_SECONDS = 90 * 24 * 3600;

const REF_SHAPE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

/** The tag as stored, or null when the value is not a tag at all. */
export function normalizeRef(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const tag = value.trim().toLowerCase();
  return REF_SHAPE.test(tag) ? tag : null;
}

/** Reads `?ref=` from a URL or a query string. */
export function refFromSearch(search: string | URLSearchParams): string | null {
  const params = typeof search === "string" ? new URLSearchParams(search.replace(/^[^?]*\?/, "")) : search;
  return normalizeRef(params.get(REF_PARAM));
}

/**
 * The tag to keep, given what was already remembered and what just arrived.
 * First touch wins; a malformed newcomer never evicts a good one.
 */
export function keepRef(remembered: string | null | undefined, arrived: string | null | undefined): string | null {
  return normalizeRef(remembered) ?? normalizeRef(arrived);
}

const UTM_KEYS = ["source", "medium", "campaign", "content", "term"] as const;
export type UtmSet = Partial<Record<(typeof UTM_KEYS)[number], string>>;

/** The UTM set of a landing, trimmed and bounded; null when the link carried none. */
export function utmFromSearch(search: string | URLSearchParams): UtmSet | null {
  const params = typeof search === "string" ? new URLSearchParams(search.replace(/^[^?]*\?/, "")) : search;
  const set: UtmSet = {};
  for (const key of UTM_KEYS) {
    const value = params.get(`utm_${key}`)?.trim();
    if (value) set[key] = value.slice(0, 120);
  }
  return Object.keys(set).length > 0 ? set : null;
}
