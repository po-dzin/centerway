/**
 * The audience rule a broadcast carries, as the database function
 * `broadcast_audience` reads it (supabase/migrations/20260915000000_broadcasts.sql).
 *
 * Pure. Anything that comes from a request passes through `normalizeAudience`
 * before it is stored, so the SQL only ever sees kinds it knows and arrays of
 * strings — a malformed rule is dropped here rather than turned into a query
 * that silently matches everyone or no one.
 */

export const AUDIENCE_KINDS = ["subscribers", "buyers", "enrolled", "registered", "leads", "tag"] as const;
export type AudienceKind = (typeof AUDIENCE_KINDS)[number];

export type AudienceRule =
  | { kind: "subscribers"; sources?: string[] }
  | { kind: "buyers"; product_codes?: string[] }
  | { kind: "enrolled"; course_ids?: string[] }
  | { kind: "registered"; opted_in_only?: boolean }
  | { kind: "leads"; product_codes?: string[] }
  | { kind: "tag"; tags: string[] };

export type Audience = { include: AudienceRule[]; exclude_tags?: string[] };

export const EMPTY_AUDIENCE: Audience = { include: [] };

const MAX_LIST = 200;

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const out = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const clean = entry.trim();
    if (clean && clean.length <= 200) out.add(clean);
    if (out.size >= MAX_LIST) break;
  }
  return [...out];
}

export function normalizeAudience(input: unknown): Audience {
  const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const include: AudienceRule[] = [];
  const seen = new Set<string>();

  for (const entry of Array.isArray(raw.include) ? raw.include : []) {
    if (!entry || typeof entry !== "object") continue;
    const rule = entry as Record<string, unknown>;
    let normalized: AudienceRule | null = null;
    switch (rule.kind) {
      case "subscribers":
        normalized = { kind: "subscribers", sources: strings(rule.sources) };
        break;
      case "buyers":
        normalized = { kind: "buyers", product_codes: strings(rule.product_codes) };
        break;
      case "enrolled":
        normalized = {
          kind: "enrolled",
          course_ids: strings(rule.course_ids).filter((id) => /^[0-9a-f-]{36}$/i.test(id)),
        };
        break;
      case "registered":
        normalized = { kind: "registered", opted_in_only: rule.opted_in_only === true };
        break;
      case "leads":
        normalized = { kind: "leads", product_codes: strings(rule.product_codes) };
        break;
      case "tag": {
        const tags = strings(rule.tags);
        // A tag rule with no tags matches nobody in SQL; keeping it would only
        // make the editor show a rule that does nothing.
        if (tags.length) normalized = { kind: "tag", tags };
        break;
      }
    }
    if (!normalized) continue;
    const key = JSON.stringify(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    include.push(normalized);
  }

  const exclude = strings(raw.exclude_tags);
  return exclude.length ? { include, exclude_tags: exclude } : { include };
}

export function audienceIsEmpty(audience: Audience): boolean {
  return audience.include.length === 0;
}
