import type { Database, Json } from "@/lib/db/database.types";

export type { Database, Json };

export type Tables = Database["public"]["Tables"];
export type TableName = keyof Tables;
export type Row<T extends TableName> = Tables[T]["Row"];
export type Insert<T extends TableName> = Tables[T]["Insert"];
export type Update<T extends TableName> = Tables[T]["Update"];

/**
 * A plain object, as the `Json` column type.
 *
 * `Record<string, unknown>` is not assignable to `Json` — the generated type
 * is recursive and `unknown` could be a function or a Date. The cast is the
 * caller's promise that the value round-trips through `JSON.stringify`, which
 * is what PostgREST does with it anyway. Kept as a named function so the
 * promise is greppable.
 */
export function asJson(value: unknown): Json {
  return value as Json;
}
