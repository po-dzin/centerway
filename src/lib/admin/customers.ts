import { orIlikeFilter } from "@/lib/api/searchFilter";
import { serviceClient } from "@/lib/db/server";

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
  created_at: string;
  /** Which identifier matched the search. Declared by the old list and never
      filled by any query; the list's branch for it stays dormant, as it was. */
  matched_link?: { type: string; value: string };
};

export type CustomersPage = { data: CustomerListItem[]; count: number };

const COLUMNS = "id, email, phone, display_name, avatar_url, tags, created_at, tg_id, google_id";

const SEARCH_COLUMNS = ["email", "phone", "display_name", "tg_id", "google_id"] as const;

export async function listCustomers(input: { q?: string; limit: number; offset: number }): Promise<CustomersPage> {
  const q = input.q?.trim() ?? "";
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
      created_at: row.created_at,
    })),
    count: count ?? 0,
  };
}
