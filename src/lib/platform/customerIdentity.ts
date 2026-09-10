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

export type CustomerContact = {
  email?: string | null;
  phone?: string | null;
};

type SupabaseLike = {
  from: (table: string) => any;
};

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
  value: string
): Promise<{ id: string; created_at: string | null } | null> {
  const { data, error } = await sb
    .from("customers")
    .select("id,created_at")
    .eq(column, value)
    .order("created_at", { ascending: true })
    .limit(1);
  if (error || !data?.[0]?.id) return null;
  return {
    id: data[0].id as string,
    created_at: typeof data[0].created_at === "string" ? data[0].created_at : null,
  };
}

/**
 * The customer id for a contact, creating the row if this is the first time we
 * have seen them. Returns null when there is nothing to key on.
 *
 * Prefers the EARLIEST matching row, so a person who bought before they filled
 * in a form keeps the history they already have rather than growing a second
 * identity beside it.
 */
export async function upsertCustomerByContact(
  sb: SupabaseLike,
  contact: CustomerContact
): Promise<string | null> {
  const email = normalizeCustomerEmail(contact.email);
  const phone = normalizeCustomerPhone(contact.phone);
  if (!email && !phone) return null;

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
    candidates
      .sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))
      .map((row) => row.id)[0] ?? null;

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
    return foundId;
  }

  const { error } = await sb.from("customers").insert({ email, phone });
  if (error) {
    // A concurrent request may have created the same customer first; the unique
    // index rejecting us is the correct outcome, not a failure.
    const code = (error as { code?: string }).code;
    if (code !== "23505") throw error;
  }

  if (email) {
    const hit = await findCustomerIdBy(sb, "email", email);
    if (hit) return hit.id;
  }
  if (phone) {
    const hit = await findCustomerIdBy(sb, "phone", phone);
    if (hit) return hit.id;
  }
  return null;
}
