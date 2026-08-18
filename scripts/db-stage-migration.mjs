/**
 * Stages ONE migration from docs/migration/sql/ into supabase/migrations/
 * so that `supabase db push` can apply it.
 *
 * Why staging instead of keeping SQL in supabase/migrations/ directly:
 * `docs/migration/sql/` is the repo's record of every schema change (AGENTS.md:
 * "Record ordinary local work in docs/** first"). Keeping a second copy would let
 * the two drift. This script generates the CLI-shaped copy from the canonical one.
 *
 * Why one file at a time — IMPORTANT:
 * the remote database has no `supabase_migrations` history (schema changes were
 * applied by hand through the SQL editor). `supabase db push` applies EVERY file
 * in supabase/migrations/, so staging the whole folder would re-run ~30 historical
 * migrations against production. Stage deliberately, one change at a time.
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
console.log("\nNext:");
console.log('  supabase db push --db-url "$SUPABASE_DB_URL" --dry-run');
console.log('  supabase db push --db-url "$SUPABASE_DB_URL"');
