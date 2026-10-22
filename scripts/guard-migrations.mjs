#!/usr/bin/env node
/**
 * Migration guard — "one version, one file, and a new one goes on top".
 *
 * WHY. Twice the version stamp, not the SQL, was what broke:
 *   * 2026-10-17: two files shared 20261017180000 (enrollment_source_service and
 *     feed_shares). `db push` stopped on a duplicate schema_migrations_pkey, and
 *     the Supabase Preview check stayed red on main for days.
 *   * 2026-10-22: a branch wrote 20261022140000 while production already held
 *     20261022150000 from another branch (a migration goes to prod BEFORE its PR
 *     merges). `db push` refuses a file that sorts below the last applied
 *     version unless told `--include-all`, so the push stops on the Mac, at the
 *     worst moment, instead of at review.
 * Both are visible from the filenames alone. This guard reads them.
 *
 * WHAT FAILS
 *   1. A file in supabase/migrations/ not named `YYYYMMDDHHMMSS_snake_name.sql`.
 *   2. Two files with the same 14-digit version.
 *   3. A file this tree adds over the base ref (origin/main, or GITHUB_BASE_REF
 *      in a pull request) whose version is not above every version the base
 *      holds. Rename it to a fresh stamp before merging.
 *
 * WHAT IT CANNOT SEE. Production can be ahead of main: a version applied from a
 * branch whose PR is still open. `npm run check:migration-drift` (needs the
 * database, run on the Mac) and `npm run db:push:dry` are the checks for that;
 * run the dry push before every real one.
 *
 * Nothing here needs a network or a secret. When the base ref is not available
 * (a shallow clone with no fetch of main), check 3 is skipped and says so.
 *
 * Usage:
 *   node scripts/guard-migrations.mjs [--base <ref>]
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const DIR = "supabase/migrations";
const NAME = /^(\d{14})_[a-z0-9_]+\.sql$/;

const argBase = (() => {
  const index = process.argv.indexOf("--base");
  return index > -1 ? process.argv[index + 1] : null;
})();

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

function resolveBase() {
  const candidates = [
    argBase,
    process.env.MIGRATION_BASE_REF,
    process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : null,
    "origin/main",
  ].filter(Boolean);
  for (const ref of candidates) {
    try {
      git(["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]);
      return ref;
    } catch {
      // Not fetched here; try the next one.
    }
  }
  return null;
}

const failures = [];
const files = fs.readdirSync(DIR).filter((file) => file.endsWith(".sql"));

const byVersion = new Map();
for (const file of files) {
  const match = NAME.exec(file);
  if (!match) {
    failures.push(`${file}: name is not YYYYMMDDHHMMSS_snake_name.sql`);
    continue;
  }
  const list = byVersion.get(match[1]) ?? [];
  list.push(file);
  byVersion.set(match[1], list);
}
for (const [version, list] of byVersion) {
  if (list.length > 1) failures.push(`version ${version} is used by ${list.length} files: ${list.join(", ")}`);
}

const base = resolveBase();
if (!base) {
  console.log(`SKIP order check: no base ref here (fetch origin/main to run it)`);
} else {
  let baseFiles = [];
  try {
    baseFiles = git(["ls-tree", "--name-only", `${base}:${DIR}`])
      .split("\n")
      .map((line) => path.basename(line))
      .filter((file) => NAME.test(file));
  } catch {
    baseFiles = [];
  }
  const baseSet = new Set(baseFiles);
  const top =
    baseFiles
      .map((file) => NAME.exec(file)[1])
      .sort()
      .at(-1) ?? "";
  const added = files.filter((file) => NAME.test(file) && !baseSet.has(file));
  for (const file of added) {
    const version = NAME.exec(file)[1];
    if (version <= top) {
      failures.push(`${file}: new over ${base}, but ${base} already holds ${top}. Give it a stamp above ${top}.`);
    }
  }
  console.log(`order: ${added.length} new over ${base} (top ${top || "none"})`);
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exit(1);
}
console.log(`PASS ${files.length} migrations: names, unique versions, new ones on top`);
