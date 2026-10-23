import { orIlikeFilter } from "@/lib/api/searchFilter";
import { serviceClient } from "@/lib/db/server";
import { normalizeTag } from "@/lib/platform/customerTags";

/**
 * The customers list, as the admin sees it. One query for the API route and
 * for the page's first render, so the two cannot disagree about what a
 * "customer" row is.
 */
export type CustomerListItem = {
  id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  tags: string[];
  /** The channels this person can be reached on, for the list's marks. */
  has_email: boolean;
  has_telegram: boolean;
  has_instagram: boolean;
  created_at: string;
  /** Which identifier matched the search. Declared by the old list and never
      filled by any query; the list's branch for it stays dormant, as it was. */
  matched_link?: { type: string; value: string };
};

export type CustomersPage = { data: CustomerListItem[]; count: number };

const COLUMNS =
  "id, email, phone, display_name, avatar_url, tags, created_at, tg_id, google_id, ig_user_id, ig_username";

const SEARCH_COLUMNS = ["email", "phone", "display_name", "tg_id", "google_id", "ig_username"] as const;

export async function listCustomers(input: {
  q?: string;
  /** Only people carrying this tag (the person card's filter, G 23.10). */
  tag?: string;
  limit: number;
  offset: number;
}): Promise<CustomersPage> {
  const q = input.q?.trim() ?? "";
  const tag = input.tag ? normalizeTag(input.tag) : null;
  let query = serviceClient()
    .from("customers")
    .select(COLUMNS, { count: "exact" })
    .range(input.offset, input.offset + input.limit - 1)
    .order("created_at", { ascending: false });
  /* The search box must not be able to edit the query's grammar: a comma 400s
     the request and a `)` silently drops the filter and returns every customer.
     `orIlikeFilter` quotes the value, so the worst a typist can do is find
     nothing. */
  const filter = orIlikeFilter(SEARCH_COLUMNS, q);
  if (filter) {
    query = query.or(filter);
  }
  if (tag) {
    query = query.contains("tags", [tag]);
  }
  const { data, error, count } = await query;
  if (error) throw new Error(error.message);
  return {
    data: (data ?? []).map((row) => ({
      id: row.id,
      display_name: row.display_name ?? null,
      email: row.email ?? null,
      phone: row.phone ?? null,
      avatar_url: row.avatar_url ?? null,
      tags: Array.isArray(row.tags) ? row.tags.filter((tag): tag is string => typeof tag === "string") : [],
      has_email: Boolean(row.email),
      has_telegram: Boolean(row.tg_id),
      has_instagram: Boolean(row.ig_user_id),
      created_at: row.created_at,
    })),
    count: count ?? 0,
  };
}

/**
 * Every tag in use, most common first: the options of the list's tag filter.
 * Read from the history table, so a tag shows up the moment any door writes it.
 */
export async function listCustomerTagOptions(): Promise<{ tag: string; count: number }[]> {
  const { data, error } = await serviceClient().from("customer_tags").select("tag").limit(20000);
  if (error) throw new Error(error.message);
  const counts = new Map<string, number>();
  for (const row of data ?? []) counts.set(row.tag, (counts.get(row.tag) ?? 0) + 1);
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
