/**
 * Links a signed-in platform account to the purchases it already owns.
 *
 * Why this exists: purchases arrive through WayForPay, which knows an email and
 * a phone but nothing about platform accounts. Until this link is written,
 * `customers.auth_user_id` stays NULL and every entitlement lookup — the LMS,
 * the profile's "мої покупки" — finds nothing (see docs/lms-h1-implementation).
 *
 * SECURITY: matching is by email, so a purchase is only handed over when the
 * identity provider has VERIFIED that email. An unverified address would let
 * anyone claim someone else's paid courses by typing their address at sign-up.
 *
 * Idempotent: rows already linked to an account are never re-pointed, so a
 * second sign-in is a no-op and one customer can never be stolen by another
 * account.
 */

import { adminClient } from "@/lib/auth/adminClient";

export type LinkPurchasesResult = {
  linked: number;
  reason: "linked" | "no_email" | "email_unverified" | "nothing_to_link";
};

export async function linkPurchasesToAccount(params: {
  authUserId: string;
  email: string | null;
  emailVerified: boolean;
}): Promise<LinkPurchasesResult> {
  const email = params.email?.trim().toLowerCase() ?? "";
  if (!email) return { linked: 0, reason: "no_email" };
  if (!params.emailVerified) return { linked: 0, reason: "email_unverified" };

  const db = adminClient();

  // Only rows that belong to nobody yet. A row already pointing at another
  // account is left alone — that is a support case, not an automatic merge.
  const { data: claimable, error: readError } = await db
    .from("customers")
    .select("id")
    .ilike("email", email)
    .is("auth_user_id", null);

  if (readError) throw new Error(`link_purchases_read_failed:${readError.message}`);

  const ids = (claimable ?? []).map((row) => row.id);
  if (ids.length === 0) return { linked: 0, reason: "nothing_to_link" };

  const { error: writeError } = await db
    .from("customers")
    .update({ auth_user_id: params.authUserId })
    .in("id", ids)
    // Re-assert the guard at write time: another request may have claimed the
    // row between the read and this update.
    .is("auth_user_id", null);

  if (writeError) throw new Error(`link_purchases_write_failed:${writeError.message}`);

  return { linked: ids.length, reason: "linked" };
}
