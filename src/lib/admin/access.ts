/**
 * Access — one place that answers "who is learning what" and "who may do what".
 *
 * Until now both answers lived only in CLI scripts (`scripts/lms-grant.mjs`,
 * `scripts/admin-role.mjs`), which means every grant needed a laptop with the
 * service-role key in `.env.local`. This module is the same three operations
 * moved behind an admin session, so the panel can do them:
 *
 *   · course access  — a row in `lms_enrollments` with source='manual'
 *   · platform role  — a row in `user_roles` (the ONE role store since
 *                      2026-08-21; `platform_users.role` is gone)
 *   · builder access — `lms_courses.author_id`, per row, NOT a role. An
 *                      "author" role would say "may edit courses", not "may
 *                      edit THESE courses" (see the authorship migration).
 *
 * Since 2026-08-26 it also carries the hand-made sale, for money that arrives
 * outside the payment provider — a transfer, cash, a partner invoice:
 *
 *   · the person       — an account for an email that has never signed in, so a
 *                        buyer is not told to log in first and call back
 *   · the payment      — a paid `orders` row, because entitlement, the profile
 *                        and every revenue report read orders, not enrollments
 *   · the deadline     — `lms_enrollments.expires_at`, per person per course
 *

 * Every mutation here writes `audit_log`. Handing out access is exactly the
 * kind of act that must be attributable afterwards.
 *
 * Progress is folded in-process from the append-only event log rather than read
 * from a counter column, because no counter column exists — `foldProgress` is
 * the only definition of "done" this codebase has, and duplicating it in SQL
 * would give the panel a second opinion.
 */

/* THE BARREL. The five aggregates that used to share this file live in
   ./access/*; everything they export is exported here, so the nine importers
   and the tests kept their paths. New code may import the module it means. */
export * from "@/lib/admin/accessTypes";
export * from "./access/accounts";
export * from "./access/courses";
export * from "./access/enrollments";
export * from "./access/payments";
export * from "./access/roles";
export * from "./access/shared";
