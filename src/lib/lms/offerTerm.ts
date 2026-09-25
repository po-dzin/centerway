import type { adminClient } from "@/lib/auth/adminClient";

import { accessRuleForNote, sameAccessRule } from "./accessTerm";

type Db = ReturnType<typeof adminClient>;

export type OfferTermOutcome = "updated" | "unchanged" | "no_offer" | "not_a_preset" | "failed";

/**
 * Carries the author's «Термін доступу» onto the offer's real term.
 *
 * Called where a course's storefront words become the live ones: a save of a
 * course that has never been published, and the approval that releases a
 * revision. NOT on a revision's save — until it is approved the words are a
 * draft, and changing what a live offer grants because an author is still
 * typing would move the terms of sale before review.
 *
 * WHAT IT DOES NOT TOUCH. The price, the currency, whether the offer is active,
 * and whether an offer exists at all — creating one is the owner's act in the
 * catalogue (`saveOffer`). No offer yet: nothing to align, and the catalogue
 * will write the note back when the owner sets one.
 *
 * BEST-EFFORT, AND LOUD. The save or the approval that called this has already
 * landed; failing it now would leave an author looking at an error for a write
 * that succeeded. A failure is logged and reported to the caller instead.
 */
export async function applyAccessTermToOffer(
  db: Db,
  input: { courseId: string; note: string | null | undefined; actorId: string | null; source: "builder" | "approval" },
): Promise<OfferTermOutcome> {
  const rule = accessRuleForNote(input.note);
  if (!rule) return "not_a_preset";
  try {
    // The course's own `course:<slug>` offer in the one table of prices.
    const { data: course, error: courseError } = await db
      .from("lms_courses")
      .select("slug")
      .eq("id", input.courseId)
      .maybeSingle();
    if (courseError) throw new Error(courseError.message);
    if (!course) return "no_offer";
    const { data: offer, error } = await db
      .from("experience_offers")
      .select("id, code, access_days, access_lifetime")
      .eq("code", `course:${course.slug as string}`)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!offer) return "no_offer";

    const current = {
      accessDays: (offer.access_days as number | null) ?? null,
      accessLifetime: Boolean(offer.access_lifetime),
    };
    if (sameAccessRule(current, rule)) return "unchanged";

    const { error: updateError } = await db
      .from("experience_offers")
      .update({
        access_days: rule.accessLifetime ? null : rule.accessDays,
        access_lifetime: rule.accessLifetime,
      })
      .eq("id", offer.id as string);
    if (updateError) throw new Error(updateError.message);

    if (input.actorId) {
      const { error: auditError } = await db.from("audit_log").insert({
        actor_id: input.actorId,
        action: "catalog.offer.term_from_course",
        entity_type: "lms_course_offer",
        entity_id: offer.code as string,
        metadata: {
          source: input.source,
          access_note: input.note ?? null,
          from: { access_days: current.accessDays, access_lifetime: current.accessLifetime },
          to: { access_days: rule.accessLifetime ? null : rule.accessDays, access_lifetime: rule.accessLifetime },
        },
      });
      if (auditError) console.error("offerTerm: audit write failed", auditError.message);
    }
    return "updated";
  } catch (error) {
    console.error(
      `offerTerm: could not align the offer term for course ${input.courseId}`,
      error instanceof Error ? error.message : error,
    );
    return "failed";
  }
}
