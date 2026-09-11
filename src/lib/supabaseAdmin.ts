/**
 * Kept as a name: 19 importers. The client itself lives in src/lib/db/server.ts,
 * which is where `server-only` guards it. New code imports `serviceClient` from
 * there; this alias goes when the last importer moves.
 */
export { serviceClient as supabaseAdmin } from "@/lib/db/server";
