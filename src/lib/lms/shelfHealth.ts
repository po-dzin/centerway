/**
 * Does the storefront still hold everything the owner thinks is on it?
 *
 * WHY THIS EXISTS. `listLiveCourses` assembles each course from its rows and
 * SKIPS any it cannot — one malformed course must not empty the shelf for the
 * others. That is the right behaviour and it has one cost: the skip is
 * announced to a server log nobody reads. On 2026-09-01 a tightened title
 * ceiling made a published, listed, priced course fail that assembly, and for
 * two days the catalogue simply did not have it while every column on the admin
 * screen still said «у продажу». Nothing was broken loudly enough to notice.
 *
 * So the skip gets a watcher. This module asks the question a person would ask
 * — "is anything we sell missing from the shelf?" — against the DATABASE, not
 * through the storefront's cache: a check that reads the same cached answer the
 * page reads can only ever confirm that the cache is consistent with itself.
 *
 * Two faults, and they are the two ways a course goes quiet:
 *
 *   · `unrenderable`      — the rows exist and cannot be assembled. The course
 *     is absent from every shelf, rail and sitemap, and `/programs/<slug>` is
 *     served from the shipped snapshot or not at all.
 *   · `sold_but_not_public` — an ACTIVE offer points at a course a stranger may
 *     not see. The money side says yes and the content side says no, so the buy
 *     button leads nowhere. `unlisted` is NOT this fault: a course sold from a
 *     landing page and deliberately kept off the shelf is a normal product.
 *
 * Server-only: reads with the service-role client.
 */

import { adminClient } from "@/lib/auth/adminClient";
import { courseFromRows } from "@/lib/lms/authoring";

type Row = Record<string, unknown>;

export type ShelfFaultKind = "unrenderable" | "sold_but_not_public";

export type ShelfFault = {
    slug: string;
    title: string;
    kind: ShelfFaultKind;
    /** The reason in the words the failure itself used. */
    detail: string;
};

export type ShelfAudit = {
    checkedAt: string;
    /** How many course rows were examined — context for "0 faults". */
    courses: number;
    faults: ShelfFault[];
};

/**
 * Reads every course and tries to build it exactly as the storefront would.
 *
 * NOT through `listLiveCourses`: that path is cached and it is the very thing
 * being audited. The rows are read fresh, and `courseFromRows` is the same
 * function the shelf uses, so a course that passes here passes there.
 */
export async function auditShelf(): Promise<ShelfAudit> {
    const db = adminClient();

    const [courseRows, moduleRows, lessonRows, offerRows] = await Promise.all([
        db.from("lms_courses").select("*"),
        db.from("lms_modules").select("*"),
        db.from("lms_lessons").select("*"),
        db.from("lms_course_offers").select("course_id, code, amount, active"),
    ]);

    const firstError = courseRows.error ?? moduleRows.error ?? lessonRows.error;
    if (firstError) throw new Error(`lms_shelf_audit_read_failed:${firstError.message}`);

    const courses = (courseRows.data ?? []) as Row[];
    const modules = (moduleRows.data ?? []) as Row[];
    const lessons = (lessonRows.data ?? []) as Row[];
    const activeOffers = new Set(
        ((offerRows.data ?? []) as Row[]).filter((row) => row.active).map((row) => row.course_id as string)
    );

    const faults: ShelfFault[] = [];

    for (const row of courses) {
        const slug = String(row.slug ?? row.id ?? "?");
        const title = String(row.title ?? slug);
        const sold = activeOffers.has(row.id as string);

        try {
            courseFromRows(
                row,
                modules.filter((module) => module.course_id === row.id),
                lessons.filter((lesson) => lesson.course_id === row.id)
            );
        } catch (error) {
            // A draft that does not assemble is an author mid-edit, not an
            // incident. What this watcher is for is material the business
            // believes is live: published, or already being sold.
            if (row.status === "published" || sold) {
                faults.push({
                    slug,
                    title,
                    kind: "unrenderable",
                    detail: error instanceof Error ? error.message : "unknown_error",
                });
            }
            continue;
        }

        if (sold && (row.status !== "published" || (row.visibility ?? "hidden") === "hidden")) {
            faults.push({
                slug,
                title,
                kind: "sold_but_not_public",
                detail: `status=${String(row.status)} visibility=${String(row.visibility ?? "hidden")}`,
            });
        }
    }

    return { checkedAt: new Date().toISOString(), courses: courses.length, faults };
}

/**
 * The audit as a message a person reads on their phone.
 *
 * Names the course by its title and its slug, because the first is what the
 * owner recognises and the second is what they will type into the admin screen
 * next. Returns null when there is nothing wrong — a watcher that reports "all
 * good" every day teaches its reader to swipe it away.
 */
export function formatShelfAudit(audit: ShelfAudit): string | null {
    if (audit.faults.length === 0) return null;

    const LABEL: Record<ShelfFaultKind, string> = {
        unrenderable: "не збирається на вітрині",
        sold_but_not_public: "продається, але не публічний",
    };

    return [
        `Вітрина: ${audit.faults.length} з ${audit.courses} курсів потребують уваги.`,
        "",
        ...audit.faults.map((fault) => `• ${fault.title} (${fault.slug}) — ${LABEL[fault.kind]}: ${fault.detail}`),
        "",
        "Адмінка → Каталог показує це саме в рядку курсу.",
    ].join("\n");
}
