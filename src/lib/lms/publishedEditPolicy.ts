import type { Course } from "@/lms-core";

/**
 * The only fields an author may change on an already-published course without
 * creating a reviewable update. This is an allow-list on purpose: a new course
 * field is reviewable by default until somebody explicitly decides otherwise.
 *
 * `cover` is presentation and `sortOrder` is the author's private builder
 * shelf order. Title, summary, promise, schedule, access rules and every bit
 * of learning material are part of the released product.
 */
export const IMMEDIATE_PUBLISHED_FIELDS = ["cover", "sortOrder"] as const;

export type ImmediatePublishedPatch = {
  cover: Course["cover"] | null;
  sortOrder: number | null;
  /** Unpublishing is a release control, not a content change. */
  status: Course["status"];
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Returns a direct live patch only when every meaningful course field is
 * unchanged. Comparing whole objects and subtracting the explicit allow-list
 * means this contract cannot accidentally be widened by a future UI field.
 */
export function immediatePublishedPatch(
  live: Course,
  incoming: Course,
): ImmediatePublishedPatch | null {
  const ignored = new Set(["cover", "sortOrder", "status", "version", "visibility"]);
  const keys = new Set([...Object.keys(live), ...Object.keys(incoming)]);
  for (const key of keys) {
    if (ignored.has(key)) continue;
    if (canonical((live as Record<string, unknown>)[key]) !== canonical((incoming as Record<string, unknown>)[key])) {
      return null;
    }
  }

  if (incoming.status !== "published" && incoming.status !== "draft") return null;
  return {
    cover: incoming.cover ?? null,
    sortOrder: incoming.sortOrder ?? null,
    status: incoming.status,
  };
}
