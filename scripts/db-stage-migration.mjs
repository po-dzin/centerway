/**
 * Stages ONE migration from docs/migration/sql/ into supabase/migrations/
 * so that `supabase db push` can apply it.
 *
 * Why staging instead of keeping SQL in supabase/migrations/ directly:
 * `docs/migration/sql/` is the repo's record of every schema change (AGENTS.md:
 * "Record ordinary local work in docs/** first"). Keeping a second copy would let
 * the two drift. This script generates the CLI-shaped copy from the canonical one.
 *
 * Why one file at a time:
 * This used to say that `supabase db push` applies EVERY file in
 * supabase/migrations/, so staging the whole folder would re-run historical
 * migrations against production. THAT IS NO LONGER TRUE and was checked on
 * 2026-09-11: production now has 76 recorded versions, and push applies only
 * what is absent from that table — its own `--include-all` flag reads "Include
 * all migrations not found on remote history table". Nothing gets re-run.
 *
 * Staging one file at a time therefore survives as a habit, not as a
 * safeguard. Whether to keep it is an open decision recorded in
 * docs/migration/README.md; until it is taken, keep staging one at a time so
 * the folder's contents stay predictable.
 *
 * NOTE this script CLEARS the staging directory on every run. Anything whose
 * only copy sits there is lost the next time someone stages something else —
 * which is how `author_profile_background` came to be live in production with
 * no SQL anywhere in the repo. The canonical file goes in docs/migration/sql/
 * FIRST; see the Publish Rhythm Rule in AGENTS.md.
 *
 * TWO THINGS THAT ARE NO LONGER TRUE / WERE NEVER SAID (noted 2026-08-22):
 *
 *   * this used to say the remote database has no `supabase_migrations`
 *     history. It does now — 20260815000000 through 20260821010000 are
 *     recorded, so someone has been pushing through the CLI. `db push`
 *     therefore refuses until the local folder matches, which is why staging
 *     one file and pushing currently errors with "Remote migration versions
 *     not found in local migrations directory". The SQL editor still works.
 *
 *     Applied that way on 2026-08-22 (storefront + course-media bucket) and
 *     recorded in `supabase_migrations.schema_migrations` by hand as
 *     20260822000000 / 20260822010000, so the history stays complete. NOTE the
 *     direct `db.<ref>.supabase.co` host is IPv6-only and unreachable from a
 *     v4-only machine; the session pooler
 *     (`aws-1-eu-west-2.pooler.supabase.com:5432`, user `postgres.<ref>`) is.
 *   * the staged version is derived from the DATE alone, so two migrations
 *     written on the same day produce the same `YYYYMMDD000000` stamp. One at
 *     a time hides it; do not assume otherwise.
 *
 * Usage:
 *   node scripts/db-stage-migration.mjs 2026-08-15_lms_foundation
 *   node scripts/db-stage-migration.mjs --clear      # empty the staging dir
 */

import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const sourceDir = path.join(rootDir, "docs", "migration", "sql");
const stageDir = path.join(rootDir, "supabase", "migrations");

const arg = process.argv[2];

function fail(message) {
  console.error(`db:stage FAILED — ${message}`);
  process.exit(1);
}

function clearStage() {
  if (!fs.existsSync(stageDir)) return [];
  const removed = fs.readdirSync(stageDir).filter((name) => name.endsWith(".sql"));
  for (const name of removed) fs.unlinkSync(path.join(stageDir, name));
  return removed;
}

if (arg === "--clear") {
  const removed = clearStage();
  console.log(`db:stage — cleared ${removed.length} staged migration(s).`);
  process.exit(0);
}

if (!arg) {
  const available = fs.existsSync(sourceDir)
    ? fs.readdirSync(sourceDir).filter((name) => name.endsWith(".sql")).sort()
    : [];
  fail(
    `no migration named.\n\nAvailable in docs/migration/sql:\n${available
      .map((name) => `  · ${name.replace(/\.sql$/, "")}`)
      .join("\n")}`
  );
}

const baseName = arg.replace(/\.sql$/, "");
const sourcePath = path.join(sourceDir, `${baseName}.sql`);

if (!fs.existsSync(sourcePath)) {
  fail(`docs/migration/sql/${baseName}.sql not found`);
}

// CLI migration files must be named <YYYYMMDDHHMMSS>_<name>.sql.
// The date comes from the canonical filename so ordering matches the record.
const dateMatch = /^(\d{4})-(\d{2})-(\d{2})_(.+)$/.exec(baseName);
if (!dateMatch) {
  fail(`filename must look like YYYY-MM-DD_name.sql, got "${baseName}.sql"`);
}

const [, year, month, day, name] = dateMatch;
const stamp = `${year}${month}${day}000000`;
const stagedName = `${stamp}_${name}.sql`;

fs.mkdirSync(stageDir, { recursive: true });
clearStage();
fs.copyFileSync(sourcePath, path.join(stageDir, stagedName));

console.log(`db:stage — staged supabase/migrations/${stagedName}`);
// `db push` is printed nowhere on purpose: it refuses while staging holds one
// file, which is always. Printing it sent people to a dead end.
console.log("\nNext:");
console.log("  npm run db:local:reset            # rehearse against populated tables");
console.log("  # apply in the Supabase SQL editor, then record the version:");
console.log(`  insert into supabase_migrations.schema_migrations (version) values ('${stamp}');`);
console.log("  npm run check:migration-drift     # confirm the repo and production agree");
console.log("\n  docs/migration/README.md explains why `db push` is not in this list.");
