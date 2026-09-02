/**
 * The catalogue as the OWNER sees it: what is on sale, for how much, for how
 * long, and what is stopping a finished course from being any of those.
 *
 * WHY A SECOND MODULE BESIDE access.ts. `access.ts` answers "who may open what"
 * — people, seats, deadlines. This answers "what is for sale" — courses,
 * prices, terms. They meet on one screen and nowhere else; keeping them in one
 * file would have made the price and the enrollment look like one subject,
 * which is exactly the confusion the 2026-08-22 split exists to prevent.
 *
 * WHY THE PRICE IS ADMIN-ONLY, RESTATED. `lms_course_offers` has a single
 * admin policy and the authoring routes hold no grant on it: an external author
 * who could set the price could set their own payout. Support may read the
 * catalogue but may not write an offer, and that is enforced in the route.
 *
 * Server-only: imports the service-role client.
 */

import { adminClient } from "@/lib/auth/adminClient";
import { AccessError, writeAudit } from "@/lib/admin/access";
import { courseOfferCode } from "@/lms-core";
import { listLiveCourses } from "@/lib/lms/liveCatalog";
import type { CatalogOffer, CatalogRow, SaleBlocker } from "@/lib/admin/catalogTypes";

/* The shapes live in catalogTypes.ts so the screen can name them without
   importing this module's service-role client. Re-exported because this is
   where the server reads them from. */
export * from "@/lib/admin/catalogTypes";

function toOffer(row: Record<string, unknown>): CatalogOffer {
    return {
        code: row.code as string,
        amount: Number(row.amount),
        listAmount: row.list_amount === null || row.list_amount === undefined ? null : Number(row.list_amount),
        currency: (row.currency as string) ?? "UAH",
        pixelContentName: (row.pixel_content_name as string) ?? "",
        accessDays: row.access_days === null || row.access_days === undefined ? null : Number(row.access_days),
        accessLifetime: Boolean(row.access_lifetime),
        active: Boolean(row.active),
        updatedAt: (row.updated_at as string | null) ?? null,
    };
}

/**
 * What is blocking the sale, in the order an operator would fix it.
 *
 * Ordered on purpose: setting a price on a course the author has not published
 * is not wrong, but it is not the next thing to do, and a checklist that says
 * so is worth more than one that dumps four faults at once.
 */
export function saleBlockersOf(input: {
    status: string;
    reviewStatus: string;
    visibility: string;
    offer: CatalogOffer | null;
    /**
     * Whether the storefront could build this course from its own rows.
     * Undefined means "not asked" — the callers that only have columns to work
     * with keep the answer they always had.
     */
    onShelf?: boolean;
}): SaleBlocker[] {
    const blockers: SaleBlocker[] = [];

    // First, because nothing below it matters while the shelf cannot render
    // the course at all — and because this is the fault an operator would
    // otherwise chase through four correct-looking columns.
    if (input.onShelf === false) blockers.push("not_renderable");

    if (input.status !== "published") blockers.push("not_published");
    else if (input.reviewStatus !== "approved") blockers.push("not_approved");

    if (input.visibility === "hidden") blockers.push("hidden");

    if (!input.offer) blockers.push("no_offer");
    else {
        if (!input.offer.active) blockers.push("offer_withdrawn");
        // Belt and braces against the CHECK: a row written before the
        // 2026-08-26 migration, or by hand, could still say nothing about time.
        if (!input.offer.accessLifetime && !input.offer.accessDays) blockers.push("no_access_rule");
    }

    return blockers;
}

/** Every course with its offer and its readiness, newest activity first. */
export async function listCatalog(): Promise<CatalogRow[]> {
    const db = adminClient();

    const { data: courseRows, error } = await db
        .from("lms_courses")
        .select(
            "id, slug, program_slug, title, status, review_status, pending_content, pending_review_status, visibility, author_id, updated_at"
        )
        .order("updated_at", { ascending: false });
    if (error) throw new AccessError(error.message, 500);

    const courses = courseRows ?? [];

    /* The shelf's OWN answer, not a second opinion about it. `listLiveCourses`
       drops any course whose rows it cannot assemble into a valid course, and
       says so only in a server log — so this screen asks it directly rather
       than inferring readiness from columns that all look fine. */
    let shelfSlugs: Set<string> | null = null;
    try {
        shelfSlugs = new Set((await listLiveCourses()).map((course) => course.slug));
    } catch {
        // A shelf that cannot be read is not evidence against any course:
        // leave the check unasked rather than accusing every row at once.
        shelfSlugs = null;
    }
    const { data: offerRows } = await db
        .from("lms_course_offers")
        .select("course_id, code, amount, list_amount, currency, pixel_content_name, access_days, access_lifetime, active, updated_at");

    const offerByCourse = new Map(
        (offerRows ?? []).map((row) => [row.course_id as string, toOffer(row as Record<string, unknown>)])
    );

    const authorIds = [...new Set(courses.map((row) => row.author_id as string | null).filter(Boolean))] as string[];
    const { data: authorRows } = authorIds.length
        ? await db.from("platform_users").select("auth_user_id, email").in("auth_user_id", authorIds)
        : { data: [] };
    const emailByAuthor = new Map((authorRows ?? []).map((row) => [row.auth_user_id as string, row.email as string | null]));

    const { data: enrollmentRows } = await db.from("lms_enrollments").select("course_id");
    const learners = new Map<string, number>();
    for (const row of enrollmentRows ?? []) {
        const key = row.course_id as string;
        learners.set(key, (learners.get(key) ?? 0) + 1);
    }

    return courses.map((row) => {
        const offer = offerByCourse.get(row.id as string) ?? null;
        // The same fallback `listCourses` uses: a course published before the
        // review columns existed counts as approved, not as pending forever.
        const reviewStatus =
            (row.review_status as string | null) ?? (row.status === "published" ? "approved" : "draft");
        const visibility = ((row.visibility as string | null) ?? "hidden") as CatalogRow["visibility"];

        const onShelf = shelfSlugs ? shelfSlugs.has(row.slug as string) : undefined;

        return {
            courseId: row.id as string,
            slug: row.slug as string,
            programSlug: (row.program_slug as string | null) ?? (row.slug as string),
            title: row.title as string,
            status: row.status as string,
            reviewStatus,
            visibility,
            hasPendingRevision: Boolean(row.pending_content),
            pendingReviewStatus: (row.pending_review_status as string | null) ?? null,
            authorEmail: emailByAuthor.get(row.author_id as string) ?? null,
            learners: learners.get(row.id as string) ?? 0,
            updatedAt: row.updated_at as string,
            offer,
            blockers: saleBlockersOf({ status: row.status as string, reviewStatus, visibility, offer, onShelf }),
        } satisfies CatalogRow;
    });
}

export type SaveOfferInput = {
    courseId: string;
    actorId: string;
    amount: number;
    listAmount?: number | null;
    currency?: string;
    /** Exactly one of these two must say something. */
    accessDays?: number | null;
    accessLifetime?: boolean;
};

/**
 * Sets the price AND the term in one act, because they are one decision.
 *
 * The term is required. An offer that does not state it grants perpetual
 * access to everyone who ever buys it — silently, and in the direction that
 * cannot be taken back once people have paid. The database CHECK says the same
 * thing; this is the sentence a human reads instead of a constraint violation.
 *
 * `pixel_content_name` is written ONCE, at creation, and never touched again:
 * it is a reporting label in Meta, and renaming it splits one product's history
 * into two lines.
 */
export async function saveOffer(input: SaveOfferInput) {
    const db = adminClient();

    const { data: course, error: courseError } = await db
        .from("lms_courses")
        .select("id, slug, title")
        .eq("id", input.courseId)
        .maybeSingle();
    if (courseError) throw new AccessError(courseError.message, 500);
    if (!course) throw new AccessError("course_not_found", 404);

    if (!Number.isInteger(input.amount) || input.amount < 0) throw new AccessError("amount_invalid", 400);

    const listAmount = input.listAmount ?? null;
    if (listAmount !== null && (!Number.isInteger(listAmount) || listAmount <= input.amount)) {
        // The struck-through figure is what the page QUOTES; below the charged
        // price it would advertise a discount that runs the wrong way.
        //
        // A FREE COURSE MAY STILL QUOTE ONE. Zero used to be refused here on
        // the theory that nothing is being discounted — but «було 795 ₴,
        // зараз безкоштовно» is the most ordinary thing a free offer says, and
        // refusing it forced the owner to choose between the price and the
        // reason it is worth taking. The only rule that has to hold is the one
        // above: the quoted figure is strictly greater than the charged one.
        throw new AccessError("list_amount_invalid", 400);
    }

    const lifetime = Boolean(input.accessLifetime);
    const accessDays = lifetime ? null : input.accessDays ?? null;
    if (!lifetime && (!Number.isInteger(accessDays) || (accessDays ?? 0) <= 0)) {
        throw new AccessError("access_rule_required", 400);
    }

    const code = courseOfferCode(course.slug as string);
    // Keyed on the COURSE, not on the code. `code` is derived from the slug, so
    // a renamed draft course produces a new code — looking up by it would miss
    // the row that already exists and try to insert a second one for the same
    // course, which `lms_course_offers_one_per_course` (2026-08-28) now refuses.
    // Finding it by course_id updates the code in place instead, and carries
    // `pixel_content_name` across the rename, which is the one field that must
    // never change once set.
    const { data: existing } = await db
        .from("lms_course_offers")
        .select("id, pixel_content_name")
        .eq("course_id", course.id)
        .maybeSingle();

    const payload = {
        course_id: course.id,
        code,
        amount: input.amount,
        list_amount: listAmount,
        currency: input.currency?.trim() || "UAH",
        pixel_content_name: (existing?.pixel_content_name as string | undefined) ?? (course.title as string),
        access_days: accessDays,
        access_lifetime: lifetime,
        active: true,
        updated_at: new Date().toISOString(),
    };

    const { error } = await db.from("lms_course_offers").upsert(payload, { onConflict: "course_id" });
    if (error) throw new AccessError(error.message, 500);

    await writeAudit(db, {
        actorId: input.actorId,
        action: "catalog.offer.save",
        entityType: "lms_course_offer",
        entityId: code,
        metadata: {
            course_slug: course.slug,
            amount: payload.amount,
            list_amount: payload.list_amount,
            currency: payload.currency,
            access_days: payload.access_days,
            access_lifetime: payload.access_lifetime,
            created: !existing,
        },
    });

    return { code, created: !existing, courseSlug: course.slug as string };
}

/**
 * Takes the offer off sale. Deactivated, never deleted — the row is the record
 * of what was sold, and orders already filed under this code have to keep
 * resolving into an entitlement.
 */
export async function setOfferActive(input: { courseId: string; active: boolean; actorId: string }) {
    const db = adminClient();

    const { data: course } = await db.from("lms_courses").select("id, slug").eq("id", input.courseId).maybeSingle();
    if (!course) throw new AccessError("course_not_found", 404);

    // By course, for the same reason as saveOffer: after a draft rename the
    // stored code no longer matches the one the slug would produce.
    const { data: existing } = await db
        .from("lms_course_offers")
        .select("id, code")
        .eq("course_id", course.id)
        .maybeSingle();
    if (!existing) throw new AccessError("offer_not_found", 404);
    const code = (existing.code as string | null) ?? courseOfferCode(course.slug as string);

    const { error } = await db
        .from("lms_course_offers")
        .update({ active: input.active, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    if (error) throw new AccessError(error.message, 500);

    await writeAudit(db, {
        actorId: input.actorId,
        action: input.active ? "catalog.offer.resume" : "catalog.offer.withdraw",
        entityType: "lms_course_offer",
        entityId: code,
        metadata: { course_slug: course.slug },
    });

    return { code, active: input.active, courseSlug: course.slug as string };
}
