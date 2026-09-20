/**
 * One-off: apply a migration from docs/migration/sql/ and record it, atomically.
 *
 * Everything happens in ONE transaction — the schema change and the row in
 * `supabase_migrations.schema_migrations` that describes it. Applying and
 * recording as two separate acts is precisely how `lead_stage` reached
 * production with its SQL stored in no place at all (docs/migration/README.md).
 *
 * The statements array is written with the real file text, so production keeps
 * a copy of the SQL rather than leaving this repo as the only one.
 *
 *   node scripts/apply-migration-once.mjs <YYYY-MM-DD>_<name> <version> [--commit]
 *
 * Without --commit it rolls back, having run everything, and prints what would
 * have changed.
 */

import fs from "node:fs";
import path from "node:path";
import pg from "pg";

import { loadEnv, rootDir } from "./lib/lms-cli.mjs";

const [slug, version, ...flags] = process.argv.slice(2);
const commit = flags.includes("--commit");
if (!slug || !/^\d{14}$/.test(version ?? "")) {
  throw new Error("usage: node scripts/apply-migration-once.mjs <YYYY-MM-DD>_<name> <14-digit version> [--commit]");
}

const file = path.join(rootDir, "docs", "migration", "sql", `${slug}.sql`);
const sql = fs.readFileSync(file, "utf8");
const name = slug.slice(11);

loadEnv();
const direct = process.env.SUPABASE_DB_URL;
const match = /^postgresql:\/\/([^:]+):([^@]+)@db\.([a-z0-9]+)\.supabase\.co:(\d+)\/(.+)$/.exec(direct ?? "");
if (!match) throw new Error("SUPABASE_DB_URL is not in the expected direct-host shape");
const [, , password, ref, , database] = match;
const host = process.env.SUPABASE_POOLER_HOST ?? "aws-1-eu-west-2.pooler.supabase.com";
const connectionString = `postgresql://postgres.${ref}:${password}@${host}:5432/${database}`;

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
const counts = async () => {
  const { rows } = await client.query(
    "select type, count(*)::int as n from public.lms_progress_events group by type order by type"
  );
  return rows.map((r) => `${r.type}=${r.n}`).join("  ");
};

await client.connect();
try {
  await client.query("BEGIN");
  console.log("before:", await counts());

  await client.query(sql);

  await client.query(
    `insert into supabase_migrations.schema_migrations (version, name, statements)
     values ($1, $2, $3)
     on conflict (version) do nothing`,
    [version, name, [sql]]
  );

  console.log("after: ", await counts());
  const { rows } = await client.query(
    `select count(*)::int as bad from (
       select enrollment_id, lesson_id
         from public.lms_progress_events
        where type in ('lesson.started', 'lesson.opened')
        group by enrollment_id, lesson_id
       having count(*) filter (where type = 'lesson.started') <> 1
     ) q`
  );
  console.log("groups without exactly one start:", rows[0].bad);
  if (rows[0].bad !== 0) throw new Error("invariant broken — refusing to commit");

  await client.query(commit ? "COMMIT" : "ROLLBACK");
  console.log(commit ? "COMMITTED" : "ROLLED BACK (pass --commit to apply)");
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  throw error;
} finally {
  await client.end();
}
