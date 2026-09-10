export function getErrorMessage(error: unknown, fallback = "unknown"): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error.trim()) return error.trim();
  return fallback;
}


/**
 * The message of a thrown value, whatever it was — the `catch (e)` form.
 *
 * Unlike `getErrorMessage` above it reads `.message` off a plain object too,
 * because most of what this app catches is not an `Error`: Supabase rejects
 * with `{ message, code, … }`. No fallback argument; `String(e)` is the floor.
 */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object" && "message" in e) {
    const m = (e as { message: unknown }).message;
    if (typeof m === "string") return m;
  }
  return String(e);
}
