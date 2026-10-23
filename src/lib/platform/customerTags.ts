/**
 * Tags on the person card (`customers`), with where each one came from.
 *
 * `customers.tags` stays the quick list the audiences and filters read;
 * `customer_tags` remembers the source and the moment of each tag (migration
 * 20261023190000_person_card.sql). This writes the history row FIRST, with the
 * real source, and the list after it: the database trigger that backs up any
 * other writer of `tags` then finds the row already there and leaves it be.
 *
 * Tags are Latin (G 23.10): lower-case letters, digits, «-» and «_».
 */

import type { Db } from "@/lib/db/server";

type SupabaseLike = Pick<Db, "from">;

const TAG = /^[a-z0-9][a-z0-9_-]{0,63}$/;

/** The tag as it is stored, or null when it is not one. */
export function normalizeTag(raw: string): string | null {
  const tag = raw.trim().toLowerCase();
  return TAG.test(tag) ? tag : null;
}

/** Where a tag came from, as `customer_tags.source` records it. */
export type TagSource = "autoreply" | "import:smartsender" | "import:sendpulse" | "import:csv" | "admin" | "app";

/**
 * Adds tags to many people at once, keeping what they already carry. Unknown
 * shapes are dropped rather than stored, so a typo never becomes a tag a
 * broadcast audience silently matches nobody with.
 */
export async function addCustomerTags(
  sb: SupabaseLike,
  customerIds: string[],
  rawTags: string[],
  source: TagSource,
  createdBy: string | null = null,
): Promise<void> {
  const tags = [...new Set(rawTags.map(normalizeTag).filter((tag): tag is string => tag !== null))];
  const ids = [...new Set(customerIds)];
  if (tags.length === 0 || ids.length === 0) return;

  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { error: historyError } = await sb.from("customer_tags").upsert(
      chunk.flatMap((customerId) =>
        tags.map((tag) => ({ customer_id: customerId, tag, source, created_by: createdBy })),
      ),
      { onConflict: "customer_id,tag", ignoreDuplicates: true },
    );
    if (historyError) throw new Error(historyError.message);

    const { data, error } = await sb.from("customers").select("id, tags").in("id", chunk);
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as { id: string; tags: string[] | null }[]) {
      const have = Array.isArray(row.tags) ? row.tags : [];
      const missing = tags.filter((tag) => !have.includes(tag));
      if (missing.length === 0) continue;
      const { error: updateError } = await sb
        .from("customers")
        .update({ tags: [...have, ...missing] })
        .eq("id", row.id);
      if (updateError) throw new Error(updateError.message);
    }
  }
}
