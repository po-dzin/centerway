/**
 * Kept as a name: 70 importers. Same client as `supabaseAdmin` — they were two
 * byte-identical factories — now both point at src/lib/db/server.ts. New code
 * imports `serviceClient` from there; this alias goes when the last importer moves.
 */
export { serviceClient as adminClient } from "@/lib/db/server";
