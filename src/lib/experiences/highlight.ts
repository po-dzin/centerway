/**
 * The one flag a storefront card may carry on its photograph (2026-09-30).
 *
 * `bestseller` is the owner's claim, stored on the thing's registry row
 * (`experiences.highlight`) and set in the admin catalogue. `new` is never
 * stored: a thing is new for its first NEW_WINDOW_DAYS on the shelf
 * (`experiences.first_listed_at`, stamped by a trigger). When both apply the
 * owner's word wins — a card carries one flag, not a row of them.
 */

export type OfferHighlight = "bestseller" | "new";

export const NEW_WINDOW_DAYS = 30;

export const HIGHLIGHT_LABELS: Record<OfferHighlight, string> = {
  bestseller: "Бестселер",
  new: "Новинка",
};

export function isStoredHighlight(value: unknown): value is "bestseller" {
  return value === "bestseller";
}

export function resolveHighlight(
  row: { highlight?: unknown; first_listed_at?: unknown } | null | undefined,
  now: Date = new Date(),
): OfferHighlight | undefined {
  if (!row) return undefined;
  if (isStoredHighlight(row.highlight)) return "bestseller";
  if (typeof row.first_listed_at !== "string") return undefined;
  const listedAt = Date.parse(row.first_listed_at);
  if (Number.isNaN(listedAt)) return undefined;
  const age = now.getTime() - listedAt;
  return age >= 0 && age < NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000 ? "new" : undefined;
}

type RegistryReader = ReturnType<typeof import("@/lib/supabaseAdmin").supabaseAdmin>;

/**
 * The flags for a set of things, by registry slug (a course's `program_slug`).
 *
 * Never throws: a flag is decoration, and a registry that cannot be read must
 * not take the catalogue down with it — the cards simply print none.
 */
export async function loadHighlights(db: RegistryReader, slugs: string[]): Promise<Map<string, OfferHighlight>> {
  const out = new Map<string, OfferHighlight>();
  if (slugs.length === 0) return out;
  try {
    const { data, error } = await db.from("experiences").select("slug, highlight, first_listed_at").in("slug", slugs);
    if (error || !data) return out;
    const now = new Date();
    for (const row of data as Array<{ slug: string; highlight: unknown; first_listed_at: unknown }>) {
      const flag = resolveHighlight(row, now);
      if (flag) out.set(row.slug, flag);
    }
  } catch {
    // Decoration only — see above.
  }
  return out;
}
