/**
 * An imported address becomes a person, not just a line on the mailing list.
 *
 * Before the person card (G 23.10) an import wrote `messaging_subscriptions`
 * and stopped: the address was mailable but nobody — no card in the admin, no
 * tags, no way to see that the Smart Sender subscriber and last month's buyer
 * are one woman. This runs after the subscription rows are in:
 *
 *   1. the database already linked every address it could to an existing card
 *      (trigger `cw_link_subscription_customer`, case-insensitive on email);
 *   2. the addresses still without a card get one, with the import as their
 *      first touch and the name the file carried;
 *   3. the trigger links those too;
 *   4. every card behind the imported addresses gets the base's tag.
 *
 * Existing cards are never renamed or re-sourced here: an import is evidence
 * that somebody was on another service's list, not who they are.
 */

import type { Db } from "@/lib/db/server";
import { addCustomerTags, type TagSource } from "@/lib/platform/customerTags";

type SupabaseLike = Pick<Db, "from">;

export type ImportSource = "csv_import" | "sendpulse_import" | "smartsender_import" | "manual";

/** The tag, the tag's recorded origin and the first-touch channel each import source leaves. */
export const IMPORT_TRACE: Record<ImportSource, { tag: string | null; tagSource: TagSource; channel: string }> = {
  smartsender_import: { tag: "smartsender", tagSource: "import:smartsender", channel: "smartsender" },
  sendpulse_import: { tag: "sendpulse", tagSource: "import:sendpulse", channel: "sendpulse" },
  csv_import: { tag: null, tagSource: "import:csv", channel: "import" },
  manual: { tag: null, tagSource: "admin", channel: "admin" },
};

const CHUNK = 200;

async function linkedCards(sb: SupabaseLike, addresses: string[]): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  for (let i = 0; i < addresses.length; i += CHUNK) {
    const { data, error } = await sb
      .from("messaging_subscriptions")
      .select("address, customer_id")
      .eq("channel", "email")
      .in("address", addresses.slice(i, i + CHUNK));
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as { address: string; customer_id: string | null }[]) {
      out.set(row.address, row.customer_id);
    }
  }
  return out;
}

/** Setting the column to what it already is fires the link trigger again. */
async function relink(sb: SupabaseLike, addresses: string[]) {
  for (let i = 0; i < addresses.length; i += CHUNK) {
    const { error } = await sb
      .from("messaging_subscriptions")
      .update({ customer_id: null })
      .eq("channel", "email")
      .is("customer_id", null)
      .in("address", addresses.slice(i, i + CHUNK));
    if (error) throw new Error(error.message);
  }
}

export async function linkImportedPeople(
  sb: SupabaseLike,
  rows: { address: string; name: string | null }[],
  source: ImportSource,
  now: () => Date = () => new Date(),
): Promise<{ linked: number; created: number }> {
  if (rows.length === 0) return { linked: 0, created: 0 };
  const trace = IMPORT_TRACE[source];
  const addresses = rows.map((row) => row.address);
  const names = new Map(rows.map((row) => [row.address, row.name]));

  /* Relink before creating anything. An address can sit without a card
     although its card exists: the card was made after the subscription
     (the link trigger fires on the subscription's side only), or a
     previous run made the card and failed before linking. Inserting a
     second card for it would hit the unique email index on every retry. */
  await relink(sb, addresses);
  let cards = await linkedCards(sb, addresses);
  const orphans = addresses.filter((address) => cards.has(address) && !cards.get(address));

  let created = 0;
  for (let i = 0; i < orphans.length; i += CHUNK) {
    const chunk = orphans.slice(i, i + CHUNK);
    const card = (email: string) => ({
      email,
      display_name: names.get(email) ?? null,
      first_touch: { channel: trace.channel, medium: "import", at: now().toISOString() },
    });
    const { data, error } = await sb.from("customers").insert(chunk.map(card)).select("id");
    if (!error) {
      created += data?.length ?? 0;
    } else if ((error as { code?: string }).code === "23505") {
      /* One card in the chunk was made in between by another door: that card
         is the one we wanted. The rest go one by one so they are not lost. */
      for (const email of chunk) {
        const one = await sb.from("customers").insert(card(email)).select("id");
        if (one.error && (one.error as { code?: string }).code !== "23505") throw new Error(one.error.message);
        created += one.data?.length ?? 0;
      }
    } else {
      throw new Error(error.message);
    }
    await relink(sb, chunk);
  }

  if (orphans.length > 0) cards = await linkedCards(sb, addresses);
  const ids = [...cards.values()].filter((id): id is string => Boolean(id));
  if (trace.tag) await addCustomerTags(sb, ids, [trace.tag], trace.tagSource);
  return { linked: ids.length, created };
}
