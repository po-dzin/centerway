/**
 * `customers` is the spine: the one table where every door a person can come
 * through — a payment, a form, a test, a bot — is supposed to meet.
 *
 * WHY THIS MOVED OUT OF THE WEBHOOK. `upsertCustomer` lived as a private
 * function inside `api/wfp/webhook/route.ts`, which meant only a payment could
 * put a person on the spine. A lead form submission wrote a row to `leads` and
 * stopped there, so somebody who asked for a consultation was not a customer of
 * ours in any queryable sense: not in the admin's customer list, not reachable
 * by the notification layer, not joinable to the test they had just taken. The
 * journey map drew that as its widest gold gap — «лид → customers: не
 * пишется» — and this file is the answer: one resolver, every door.
 *
 * MATCHING IS BY EMAIL OR PHONE, AND DELIBERATELY NOT BY ANYTHING ELSE. Those
 * are the two keys a payment callback carries, so they are the two keys that
 * can tie a form submission to a past purchase. Sign-in linking is a separate,
 * stricter path (`linkPurchasesToAccount`) because handing over PURCHASES
 * requires the identity provider to have verified the address; putting a person
 * on the spine does not.
 */

import type { Db } from "@/lib/db/server";

export type CustomerContact = {
  email?: string | null;
  phone?: string | null;
};

/* Only `.from` is ever used; taking just that keeps the tests' fake table
   honest — it must satisfy the real builder's shape, not `any`. */
type SupabaseLike = Pick<Db, "from">;

export function normalizeCustomerEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const value = email.trim().toLowerCase();
  return value ? value : null;
}

export function normalizeCustomerPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const value = phone.trim();
  return value ? value : null;
}

async function findCustomerIdBy(
  sb: SupabaseLike,
  column: "email" | "phone",
  value: string,
): Promise<{ id: string; created_at: string | null } | null> {
  const { data, error } = await sb
    .from("customers")
    .select("id,created_at")
    .eq(column, value)
    .order("created_at", { ascending: true })
    .limit(1);
  /* Bound once: `noUncheckedIndexedAccess` means a guard on `data?.[0]` does
     not narrow a second `data[0]`, and the old `as string` was hiding that. */
  const row = data?.[0];
  if (error || !row?.id) return null;
  return {
    id: row.id,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
  };
}

export type UpsertCustomerResult = {
  id: string | null;
  /**
   * Whether this call CREATED the row, as opposed to finding one that already
   * existed.
   *
   * This is not bookkeeping — it is a trust boundary. The lead form is public,
   * unauthenticated and CORS-open, and it upserts on whatever contact the
   * submitter typed. If they type somebody else's address, this resolver
   * correctly returns that person's existing customer row, and any profile
   * field written from the same submission would be an unauthenticated write to
   * a stranger's record. So callers who want to write a name or a tag ask this
   * first and only do it for a row they themselves brought into being; a row
   * that already existed is somebody with a history, and unverified input does
   * not get to edit it.
   */
  created: boolean;
};

/**
 * The customer id for a contact, creating the row if this is the first time we
 * have seen them. Returns a null id when there is nothing to key on.
 *
 * Prefers the EARLIEST matching row, so a person who bought before they filled
 * in a form keeps the history they already have rather than growing a second
 * identity beside it.
 */
export async function upsertCustomerByContact(
  sb: SupabaseLike,
  contact: CustomerContact,
): Promise<UpsertCustomerResult> {
  const email = normalizeCustomerEmail(contact.email);
  const phone = normalizeCustomerPhone(contact.phone);
  if (!email && !phone) return { id: null, created: false };

  const candidates: Array<{ id: string; created_at: string | null }> = [];
  if (email) {
    const hit = await findCustomerIdBy(sb, "email", email);
    if (hit) candidates.push(hit);
  }
  if (phone) {
    const hit = await findCustomerIdBy(sb, "phone", phone);
    if (hit) candidates.push(hit);
  }

  const foundId =
    candidates.sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "")).map((row) => row.id)[0] ?? null;

  if (foundId) {
    /* PATCH WHAT THE CALLER CARRIED, AND ONLY THAT. This used to write both
       columns unconditionally, so a callback that quoted an email and no phone
       wrote NULL over the stored phone. That is not a cosmetic loss: the match
       above can find a customer BY phone, so the erased column was, for older
       purchases made before we collected emails, the only key tying a person to
       what they had bought. */
    const patch: { email?: string; phone?: string } = {};
    if (email) patch.email = email;
    if (phone) patch.phone = phone;
    if (Object.keys(patch).length > 0) {
      const { error } = await sb.from("customers").update(patch).eq("id", foundId);
      if (error) throw error;
    }
    return { id: foundId, created: false };
  }

  let raced = false;
  const { error } = await sb.from("customers").insert({ email, phone });
  if (error) {
    // A concurrent request may have created the same customer first; the unique
    // index rejecting us is the correct outcome, not a failure.
    const code = (error as { code?: string }).code;
    if (code !== "23505") throw error;
    /* Another request created this customer between our lookup and our insert.
       The row exists but WE did not make it, and treating a lost race as a
       creation would hand unverified input the write access the flag exists to
       deny. */
    raced = true;
  }

  if (email) {
    const hit = await findCustomerIdBy(sb, "email", email);
    if (hit) return { id: hit.id, created: !raced };
  }
  if (phone) {
    const hit = await findCustomerIdBy(sb, "phone", phone);
    if (hit) return { id: hit.id, created: !raced };
  }
  return { id: null, created: false };
}
