#!/usr/bin/env node
/**
 * `supabase db push` against production, through the pooler.
 *
 *   npm run db:push:dry   — list what would be applied, apply nothing
 *   npm run db:push       — apply every migration the journal does not have
 *
 * The journal is `supabase_migrations.schema_migrations`, and since 2026-09-10
 * it is complete: every file in supabase/migrations/ is recorded there, so a
 * push applies only what is new. A migration applied by hand (psql) must be
 * registered in the journal by hand too, or the next push re-runs it.
 */
import { spawnSync } from "node:child_process";

import { describe, poolerUrl } from "./lib/db-url.mjs";

const dry = process.argv.includes("--dry-run");
const url = poolerUrl();
console.log(`${dry ? "dry run" : "push"} → ${describe(url)}`);
const result = spawnSync("supabase", ["db", "push", "--db-url", url, ...(dry ? ["--dry-run"] : [])], {
  stdio: "inherit",
});
process.exit(result.status ?? 1);
