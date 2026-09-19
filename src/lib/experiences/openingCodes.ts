import type { adminClient } from "@/lib/auth/adminClient";

/**
 * WHICH ORDER CODES OPEN A COURSE (2026-09-20).
 *
 * Read from the `course_opening_codes` view: every code of every offer that
 * belongs to the course's thing or includes it (`experience_offer_items`), and
 * every old code of those offers (`offer_aliases`). Withdrawn offers count —
 * withdrawing stops sales, it does not undo them.
 *
 * TRANSITIONAL UNION. `lms_courses.entitlement_product_codes` is merged in until
 * the cleanup step drops it, so a code only the array knew cannot silently stop
 * opening a course. On 2026-09-20 the view already covered every array on the
 * local snapshot of production.
 *
 * A READ THAT FAILS falls back to the array alone — which is exactly the rule
 * that was in force before this existed, never less.
 */

type Db = ReturnType<typeof adminClient>;

export async function loadOpeningCodes(db: Db, courseIds: readonly string[]): Promise<Map<string, string[]>> {
  const byCourse = new Map<string, string[]>();
  if (courseIds.length === 0) return byCourse;
  const { data, error } = await db
    .from("course_opening_codes")
    .select("course_id, code")
    .in("course_id", [...courseIds]);
  if (error || !data) return byCourse;
  for (const row of data as { course_id: string | null; code: string | null }[]) {
    if (!row.course_id || !row.code) continue;
    const list = byCourse.get(row.course_id) ?? [];
    list.push(row.code);
    byCourse.set(row.course_id, list);
  }
  return byCourse;
}

/** The course's declared codes, widened by the ones the offer tables say open it. */
export function openingCodesFor(
  course: { id: string; entitlementProductCodes: readonly string[] },
  fromTables: Map<string, string[]>,
): string[] {
  return [...new Set([...course.entitlementProductCodes, ...(fromTables.get(course.id) ?? [])])];
}
