/**
 * «Хто привів» as a person, not a typed word (2026-10-22).
 *
 * The referral tag (`?ref=olena`) is what `lms_enrollments.ref` and
 * `orders.ref` store, and it is what an ambassador's own link carries — so it
 * stays the stored value. What changes is how the admin names it: by picking
 * the account, found by email. The account's `platform_users.ref_tag` is that
 * person's tag; one who has none yet is given one, once, made from their
 * address and kept unique. Later links and later grants then say the same.
 */

import { normalizeRef } from "@/lib/referral/ref";
import { resolveAccountByEmail } from "./accounts";
import { AccessError, type Db, writeAudit } from "./shared";

/** `Olena.K+cw@gmail.com` → `olena-k-cw`: the address's local part, in the tag's shape. */
export function tagFromEmail(email: string): string {
  const local = email.trim().toLowerCase().split("@")[0] ?? "";
  const shaped = local
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 56);
  return normalizeRef(shaped) ?? "friend";
}

/**
 * The referrer's tag, given to them now if they have none.
 *
 * Unique by the index on `ref_tag`: a taken tag gets `-2`, `-3`… A concurrent
 * grant that took the same one first loses on the index and retries once.
 */
export async function referrerTag(db: Db, email: string, actorId: string): Promise<string> {
  const account = await resolveAccountByEmail(db, email);
  const { data, error } = await db
    .from("platform_users")
    .select("ref_tag")
    .eq("auth_user_id", account.authUserId)
    .maybeSingle();
  if (error) throw new AccessError(error.message, 500);
  const own = normalizeRef(data?.ref_tag ?? null);
  if (own) return own;

  const base = tagFromEmail(account.email ?? email);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data: taken, error: takenError } = await db
      .from("platform_users")
      .select("ref_tag")
      .like("ref_tag", `${base}%`);
    if (takenError) throw new AccessError(takenError.message, 500);
    const used = new Set((taken ?? []).map((row) => row.ref_tag as string));
    let tag = base;
    for (let n = 2; used.has(tag); n += 1) tag = `${base}-${n}`;

    const { error: writeError } = await db
      .from("platform_users")
      .update({ ref_tag: tag })
      .eq("auth_user_id", account.authUserId)
      .is("ref_tag", null);
    if (!writeError) {
      await writeAudit(db, {
        actorId,
        action: "access.referrer.tag",
        entityType: "platform_user",
        entityId: account.authUserId,
        metadata: { email: account.email, ref_tag: tag },
      });
      // Re-read: if another grant tagged this person in between, theirs stands.
      const { data: after } = await db
        .from("platform_users")
        .select("ref_tag")
        .eq("auth_user_id", account.authUserId)
        .maybeSingle();
      return normalizeRef(after?.ref_tag ?? null) ?? tag;
    }
    // 23505: somebody else took this tag a moment ago — look again.
    if (writeError.code !== "23505") throw new AccessError(writeError.message, 500);
  }
  throw new AccessError("referrer_tag_conflict", 409);
}
