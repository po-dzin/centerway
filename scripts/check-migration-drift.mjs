/**
 * Guard: every schema change live in production must have its SQL in the repo.
 *
 * Every other `check:*` in this project compares files with files, so none of
 * them can see the one failure that actually matters — a change applied to the
 * database that the repository does not mention. On 2026-09-11 one was found:
 * `author_profile_background`, applied on 2026-08-29, its SQL committed into
 * the old staging directory and deleted along with it two weeks later. The text
 * was still in git history and in the database's journal — identical in both —
 * so nothing was lost; it was simply invisible where a reader would look. This
 * exists so the next one is caught the same week instead of by accident.
 *
 * That audit also produced a FALSE positive, which is why `behindMain()` exists
 * below: run from a branch 47 commits behind `main`, it called `lead_stage`
 * unrecorded when `main` had held the file all along.
 *
 * THE FOLDER MOVED. This guard was written against `docs/migration/sql/`, back
 * when `supabase/migrations/` was a gitignored staging queue holding one file
 * at a time. ADR-0001 (`docs/adr/0001-migrations-live-in-supabase-migrations.md`)
 * retired that queue: `supabase/migrations/` is now the committed record, one
 * file per change, named `YYYYMMDDHHMMSS_name.sql`, reconciled one-to-one
 * against the production journal on 2026-09-10. `docs/migration/sql/` and
 * `scripts/db-stage-migration.mjs` are gone — that staging queue is exactly what
 * let 47 migrations reach production unregistered.
 *
 * THE COMPARISON MOVED WITH IT. Under the old scheme a file's version stamp was
 * derived from its date alone, so same-day migrations shared a stamp and dates
 * could not identify anything; matching had to be by name. Under ADR-0001 the
 * filename *carries* the journal version, so the two are compared BY VERSION —
 * the key the journal is actually keyed on, and the only unambiguous one. Names
 * are still read, but only to report a rename: a journal row registered by hand
 * can have no name at all, so a name is not a key.
 *
 * WHAT FAILS THE CHECK — exactly one thing: a version in
 * `supabase_migrations.schema_migrations` with no matching file in
 * `supabase/migrations/`. Nothing else exits non-zero.
 *
 * WHAT DOES NOT FAIL, and why:
 *   * a file with no applied version. It should be empty under ADR-0001 — a
 *     migration written and then decided against lives in
 *     `docs/migration/declined/`, outside the canon — but a file written just
 *     before its push is a working state, not a defect.
 *   * a version whose journal name differs from the file's. Renaming a file
 *     does not rewrite history; the stamp is what ties the two together.
 *   * two files sharing one version stamp. Reported loudly, because it breaks
 *     the one-to-one claim ADR-0001 makes and leaves push order ambiguous, but
 *     it cannot hide an unrecorded version, so it does not block.
 *   * a version recorded with zero statements. It is reported, because it means
 *     the SQL text lives nowhere but the repo, and the repo copy is the only
 *     copy left — worth seeing, not worth blocking on.
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

const sqlDir = path.join(rootDir, "supabase", "migrations");

/** `YYYYMMDDHHMMSS_name.sql` — the stamp is the journal version, verbatim. */
const FILE_SHAPE = /^(\d{14})_(.+)\.sql$/;

/**
 * The direct `db.<ref>.supabase.co` host is IPv6-only and does not resolve from
 * a v4-only machine. The session pooler does, so a name-resolution failure is
 * retried there rather than reported as "the database is down".
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
          ORDER BY version`,
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
  const files = fs.readdirSync(sqlDir).filter((file) => file.endsWith(".sql"));
  const entries = [];
  const malformed = [];
  for (const file of files) {
    const match = FILE_SHAPE.exec(file);
    if (!match) {
      malformed.push(file);
      continue;
    }
    entries.push({ file, version: match[1], name: match[2] });
  }
  entries.sort((a, b) => a.version.localeCompare(b.version));
  return { entries, malformed };
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
      `supabase/migrations/ may be missing files that already exist there.\n` +
      `         Anything reported below as unrecorded may simply be newer than this branch.\n` +
      `         Run \`git fetch origin\` and re-run from an up-to-date checkout before acting.\n`,
  );
}

const history = await readHistory();
const { entries: canon, malformed } = readCanon();

if (malformed.length) {
  console.warn(
    `WARNING: ${malformed.length} file(s) in supabase/migrations/ are not named ` +
      `YYYYMMDDHHMMSS_name.sql, so they cannot be matched to a journal version:\n` +
      malformed.map((file) => `         ${file}`).join("\n") +
      `\n         Rename each to the version production recorded for it (ADR-0001) before trusting the numbers below.\n`,
  );
}

const canonByVersion = new Map();
const duplicates = [];
for (const entry of canon) {
  const existing = canonByVersion.get(entry.version);
  if (existing) duplicates.push([existing, entry]);
  else canonByVersion.set(entry.version, entry);
}

const historyByVersion = new Map(history.map((row) => [row.version, row]));

const unrecorded = history.filter((row) => !canonByVersion.has(row.version));
const unapplied = canon.filter((entry) => !historyByVersion.has(entry.version));
const nameSkew = history
  .filter((row) => canonByVersion.has(row.version) && row.name)
  .map((row) => ({ row, entry: canonByVersion.get(row.version) }))
  .filter(({ row, entry }) => row.name !== entry.name);
const textless = history.filter((row) => row.statement_count === 0);

console.log(
  `production ${history.length} · repo ${canon.length} · matched by version ${history.length - unrecorded.length}`,
);

if (duplicates.length) {
  console.log(`\ntwo files share one version stamp (${duplicates.length}) — fix, but not a failure:`);
  for (const [first, second] of duplicates) console.log(`   ${first.version}  ${first.file}  <->  ${second.file}`);
  console.log(
    `   ADR-0001 is one file per journal row. Rename whichever one borrowed the stamp\n` +
      `   to the version production actually recorded for it.`,
  );
}
if (unapplied.length) {
  console.log(`\nin the repo, not in the journal (${unapplied.length}) — informational:`);
  for (const entry of unapplied) console.log(`   ${entry.version}  ${entry.name}`);
}
if (nameSkew.length) {
  console.log(`\nrenamed since it was applied (${nameSkew.length}) — informational:`);
  for (const { row, entry } of nameSkew) console.log(`   ${row.version}  journal "${row.name}" · file "${entry.name}"`);
}
if (textless.length) {
  console.log(`\napplied with no stored statements (${textless.length}) — the repo holds the only copy:`);
  for (const row of textless) console.log(`   ${row.version}  ${row.name || "(unnamed)"}`);
}

if (unrecorded.length) {
  console.error(
    `\ncheck:migration-drift FAILED — ${unrecorded.length} change(s) live in production with no SQL in supabase/migrations/:`,
  );
  for (const row of unrecorded) {
    console.error(`   ${row.version}  ${row.name || "(unnamed)"}  statements=${row.statement_count}`);
  }
  console.error(
    `\nRecover before doing anything else. If statements > 0 the text is still in the journal:\n` +
      `   select unnest(statements) from supabase_migrations.schema_migrations where version = '<version>';\n` +
      `Write it to supabase/migrations/<version>_<name>.sql — the stamp is the version, verbatim.\n` +
      `If statements = 0 it exists nowhere — reconstruct it from the live schema and say so in the file header.`,
  );
  process.exit(1);
}

console.log(`\ncheck:migration-drift OK — every applied migration has its SQL in the repo.`);
