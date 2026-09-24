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

/**
 * The codes that say a course was bought FOR ITSELF (2026-09-25).
 *
 * `course_opening_codes` also lists the codes of bundles that carry a course in
 * — the Шлях 21 cohort opens Reset Day. That is right for the door and wrong
 * for everything that talks to a buyer about the course as their purchase:
 * a cohort buyer must not get a «you paid for Reset Day and never opened it»
 * nudge, nor a second daily reminder from a program they did not choose.
 *
 * Own = the course's declared codes, its `course:<slug>`, and every code or old
 * code of an offer belonging to the course's own thing. A failed read answers
 * with the declared codes alone — which only ever narrows who is nudged.
 */
export async function loadOwnCodes(
  db: Db,
  courses: ReadonlyArray<{ id: string; slug: string; entitlementProductCodes: readonly string[] }>,
): Promise<Map<string, Set<string>>> {
  const own = new Map<string, Set<string>>(
    courses.map((course) => [
      course.id,
      new Set([...course.entitlementProductCodes, `course:${course.slug}`].map((code) => code.toLowerCase())),
    ]),
  );
  if (courses.length === 0) return own;
  try {
    const { data: courseRows } = await db
      .from("lms_courses")
      .select("id, experience_id")
      .in(
        "id",
        courses.map((course) => course.id),
      );
    const experienceIds = [
      ...new Set((courseRows ?? []).map((row) => row.experience_id as string | null).filter(Boolean)),
    ] as string[];
    if (experienceIds.length === 0) return own;

    const { data: offers } = await db
      .from("experience_offers")
      .select("id, code, experience_id")
      .in("experience_id", experienceIds);
    const offerIds = (offers ?? []).map((row) => row.id as string);
    const { data: aliases } = offerIds.length
      ? await db.from("offer_aliases").select("code, offer_id").in("offer_id", offerIds)
      : { data: [] as Array<{ code: string; offer_id: string }> };

    const codesByExperience = new Map<string, string[]>();
    const experienceByOffer = new Map((offers ?? []).map((row) => [row.id as string, row.experience_id as string]));
    const push = (experienceId: string | undefined, code: string) => {
      if (!experienceId) return;
      codesByExperience.set(experienceId, [...(codesByExperience.get(experienceId) ?? []), code.toLowerCase()]);
    };
    for (const row of offers ?? []) push(row.experience_id as string, row.code as string);
    for (const row of aliases ?? []) push(experienceByOffer.get(row.offer_id as string), row.code as string);

    for (const row of courseRows ?? []) {
      const set = own.get(row.id as string);
      for (const code of codesByExperience.get(row.experience_id as string) ?? []) set?.add(code);
    }
  } catch {
    // Declared codes only.
  }
  return own;
}
