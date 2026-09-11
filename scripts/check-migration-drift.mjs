/**
 * Guard: every schema change live in production must have its SQL in the repo.
 *
 * Every other `check:*` in this project compares files with files, so none of
 * them can see the one failure that actually matters — a change applied to the
 * database that this folder does not mention. On 2026-09-11 one was found:
 * `author_profile_background`, applied on 2026-08-29, its SQL committed into
 * the staging directory and deleted along with it two weeks later, never
 * written to `docs/migration/sql/`. The text was still in git history and in
 * the database's history table — identical in both — so nothing was lost; it
 * was simply invisible where a reader would look. This exists so the next one
 * is caught the same week instead of by accident.
 *
 * That audit also produced a FALSE positive, which is why `behindMain()` exists
 * below: run from a branch 47 commits behind `main`, it called `lead_stage`
 * unrecorded when `main` had held the file all along.
 *
 * WHAT FAILS THE CHECK — exactly one thing: a version in
 * `supabase_migrations.schema_migrations` with no matching file in
 * `docs/migration/sql/`. Nothing else exits non-zero.
 *
 * WHAT DOES NOT FAIL, and why:
 *   * a file with no applied version. This repo deliberately keeps prepared but
 *     unapplied SQL — `2026-08-31_reset_day_title_dedup.sql` opens with
 *     "Prepared, NOT applied. Run after review". Failing on those would train
 *     everyone to ignore the guard.
 *   * a name that matches on a different date. `two_locales` was written on the
 *     27th and applied on the 28th. That is a working week, not a defect.
 *   * a version recorded with zero statements. It is reported, because it means
 *     the SQL text lives nowhere but the repo, and the repo copy is the only
 *     copy left — worth seeing, not worth blocking on.
 *
 * Matching is BY NAME, not by date: the staged version is derived from the date
 * alone (see db-stage-migration.mjs), so same-day migrations share a stamp and
 * dates cannot identify anything.
 *
 * This check needs database credentials and a network, so it is NOT part of
 * `lms:qa` or any gate that runs without secrets. Run it deliberately:
 *   npm run check:migration-drift
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

import { loadEnv, rootDir } from "./lib/lms-cli.mjs";

const sqlDir = path.join(rootDir, "docs", "migration", "sql");

/**
 * The direct `db.<ref>.supabase.co` host is IPv6-only and does not resolve from
 * a v4-only machine — the same trap documented in db-stage-migration.mjs. The
 * session pooler does, so a name-resolution failure is retried there rather
 * than reported as "the database is down".
 */
const POOLER_HOST = process.env.SUPABASE_POOLER_HOST ?? "aws-1-eu-west-2.pooler.supabase.com";

function poolerUrlFrom(direct) {
  const match = /^postgresql:\/\/([^:]+):([^@]+)@db\.([a-z0-9]+)\.supabase\.co:(\d+)\/(.+)$/.exec(direct);
  if (!match) return null;
  const [, , password, ref, , database] = match;
  return `postgresql://postgres.${ref}:${password}@${POOLER_HOST}:5432/${database}`;
}

async function readHistory() {
  loadEnv();
  const direct = process.env.SUPABASE_MIGRATION_DB_URL ?? process.env.SUPABASE_DB_URL;
  if (!direct) throw new Error("Missing SUPABASE_DB_URL (or SUPABASE_MIGRATION_DB_URL)");

  const candidates = [direct, poolerUrlFrom(direct)].filter(Boolean);
  let lastError;
  for (const connectionString of candidates) {
    const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
    try {
      await client.connect();
      const { rows } = await client.query(
        `SELECT version,
                COALESCE(name, '') AS name,
                COALESCE(array_length(statements, 1), 0) AS statement_count
           FROM supabase_migrations.schema_migrations
          ORDER BY version`
      );
      await client.end();
      return rows;
    } catch (error) {
      lastError = error;
      await client.end().catch(() => {});
      // Only a name-resolution failure is worth retrying elsewhere; a bad
      // password or a missing table means the same thing on either host.
      if (error.code !== "ENOTFOUND" && error.code !== "EAI_AGAIN") throw error;
    }
  }
  throw lastError;
}

function readCanon() {
  if (!fs.existsSync(sqlDir)) throw new Error(`Missing ${path.relative(rootDir, sqlDir)}`);
  return fs
    .readdirSync(sqlDir)
    .filter((file) => file.endsWith(".sql"))
    .map((file) => ({ file, date: file.slice(0, 10), name: file.slice(11, -4) }));
}

/**
 * The comparison is only as current as the checkout. This guard was written
 * after an audit run from a branch 47 commits behind `main` reported a
 * migration as missing that `main` had had all along — the same mistake it
 * exists to catch, made by the tool itself. A stale checkout cannot be
 * detected from the database, so say so before the numbers are read.
 */
function behindMain() {
  try {
    const out = execFileSync("git", ["rev-list", "--count", "HEAD..origin/main"], {
      cwd: rootDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return Number(out.trim());
  } catch {
    return null;
  }
}

const behind = behindMain();
if (behind) {
  console.warn(
    `WARNING: this checkout is ${behind} commit(s) behind origin/main, so ` +
      `docs/migration/sql/ may be missing files that already exist there.\n` +
      `         Anything reported below as unrecorded may simply be newer than this branch.\n` +
      `         Run \`git fetch origin\` and re-run from an up-to-date checkout before acting.\n`
  );
}

const history = await readHistory();
const canon = readCanon();
const canonByName = new Map(canon.map((entry) => [entry.name, entry]));
const historyByName = new Map(history.map((row) => [row.name, row]));

const unrecorded = history.filter((row) => !canonByName.has(row.name));
const unapplied = canon.filter((entry) => !historyByName.has(entry.name));
const dateSkew = history
  .filter((row) => canonByName.has(row.name))
  .map((row) => ({ row, entry: canonByName.get(row.name) }))
  .filter(({ row, entry }) => `${row.version.slice(0, 4)}-${row.version.slice(4, 6)}-${row.version.slice(6, 8)}` !== entry.date);
const textless = history.filter((row) => row.statement_count === 0);

console.log(`production ${history.length} · repo ${canon.length} · matched by name ${history.length - unrecorded.length}`);

if (unapplied.length) {
  console.log(`\nprepared, not applied (${unapplied.length}) — informational:`);
  for (const entry of unapplied) console.log(`   ${entry.date}  ${entry.name}`);
}
if (dateSkew.length) {
  console.log(`\nwritten and applied on different days (${dateSkew.length}) — informational:`);
  for (const { row, entry } of dateSkew) console.log(`   ${entry.date} written, ${row.version} applied  ${entry.name}`);
}
if (textless.length) {
  console.log(`\napplied with no stored statements (${textless.length}) — the repo holds the only copy:`);
  for (const row of textless) console.log(`   ${row.version}  ${row.name || "(unnamed)"}`);
}

if (unrecorded.length) {
  console.error(`\ncheck:migration-drift FAILED — ${unrecorded.length} change(s) live in production with no SQL in docs/migration/sql/:`);
  for (const row of unrecorded) console.error(`   ${row.version}  ${row.name || "(unnamed)"}  statements=${row.statement_count}`);
  console.error(
    `\nRecover before doing anything else. If statements > 0 the text is still in the history table:\n` +
      `   select unnest(statements) from supabase_migrations.schema_migrations where version = '<version>';\n` +
      `If statements = 0 it exists nowhere — reconstruct it from the live schema and say so in the file header.`
  );
  process.exit(1);
}

console.log(`\ncheck:migration-drift OK — every applied migration has its SQL in the repo.`);
