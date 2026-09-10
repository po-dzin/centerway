/**
 * The message of a thrown value, whatever it was.
 *
 * `catch (e)` binds `unknown`, and most of what this app catches is not an
 * `Error`: Supabase rejects with a plain `{ message, code, ... }` object, and a
 * `throw "string"` still happens in a few older paths. Every site used to spell
 * the same `String(e?.message ?? e)` dance with `e: any` to make it compile —
 * this is that dance, once, without the `any`.
 */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message: unknown }).message;
    if (typeof m === "string") return m;
  }
  return String(e);
}
