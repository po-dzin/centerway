/**
 * Local Supabase stack: build a copy of production's SHAPE on this machine,
 * fill it with production's CONTENT and invented PEOPLE, and rehearse the
 * pending migration against it before it ever touches production.
 *
 * WHY THIS EXISTS
 *
 * Until 2026-09-10 there was one database. `npm run dev` on port 8000 wrote to
 * the same rows customers were reading, so the only safe place to look at a
 * change was a deployment — which is how a working day turned into a deploy
 * every half hour. This gives that check a home that costs nothing to break.
 *
 * THE THREE-WAY SPLIT, AND WHY
 *
 *   shape    pg_dump of `public`, schema only. Real constraints, real RLS,
 *            real triggers — a migration that fails here fails in production.
 *   content  courses, lessons, offers, test questions. Real rows, because a
 *            storefront with invented courses proves nothing about layout,
 *            slugs, or the contract ceiling. None of it is personal.
 *   people   customers, orders, payments, enrollments, roles. INVENTED. Real
 *            customer emails and payment records have no business sitting on a
 *            laptop or in a repository, and nothing about a checkout bug needs
 *            them to be real.
 *
 * ORDER OF ASSEMBLY (`reset`), and why it is not the obvious one:
 *
 *   shape -> accounts -> content -> people -> supabase/migrations/*.sql
 *
 * The pending migration runs LAST, against populated tables. That is the point:
 * in production it will also meet a full database, so a backfill that silently
 * does nothing against empty tables, or a NOT NULL that only fails when rows
 * exist, has to fail here first.
 *
 * SAFETY
 *
 *   `sync`  only ever READS production, over the session pooler (the direct
 *           db.<ref> host is IPv6-only and unreachable from this machine).
 *   `reset` only ever WRITES to 127.0.0.1:54322 — hardcoded, and it refuses to
 *           run if the port answers as anything but the local stack.
 *
 * Usage:
 *   node scripts/db-local.mjs sync     # production -> supabase/local/*.sql
 *   node scripts/db-local.mjs reset    # supabase/local/*.sql -> local postgres
 *   node scripts/db-local.mjs env      # write .env.development.local
 *   node scripts/db-local.mjs env --off
 *   node scripts/db-local.mjs status
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

const rootDir = process.cwd();
const localDir = path.join(rootDir, "supabase", "local");

// Hardcoded on purpose — see SAFETY above. Never read from the environment.
const LOCAL_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

/**
 * Tables whose rows are content, not people. Everything not listed here is
 * either invented in 040_people.sql or left empty (events, jobs, audit_log,
 * rate_limits, agent_*, analytics_meta_* — all reconstructible noise).
 */
const CONTENT_TABLES = [
  "lms_authors",
  "lms_courses",
  "lms_modules",
  "lms_lessons",
  "lms_media_assets",
  "lms_course_offers",
  "product_offers",
  "test_definitions",
  "test_questions",
  "test_options",
];

/**
 * Columns that point at auth.users from a content table. Those accounts have to
 * exist locally or the content will not load, so `sync` collects the ids and
 * writes them into 030_accounts.sql as sign-in-able local accounts.
 */
const CONTENT_AUTHOR_REFS = [
  ["lms_authors", "auth_user_id"],
  ["lms_courses", "author_id"],
  ["lms_courses", "approved_by"],
  ["lms_media_assets", "uploaded_by"],
];

const MATVIEWS = ["mv_funnel_daily", "mv_quality_gaps", "mv_revenue_by_campaign"];

function loadEnv() {
  const envPath = path.join(rootDir, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    if (!process.env[key]) {
      process.env[key] = trimmed
        .slice(index + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
    }
  }
}

/** libpq from Homebrew is not on PATH; the CLI ships no psql of its own. */
function pgBin(name) {
  const brewed = `/opt/homebrew/opt/libpq/bin/${name}`;
  if (fs.existsSync(brewed)) return brewed;
  const found = spawnSync("which", [name], { encoding: "utf8" });
  if (found.status === 0) return found.stdout.trim();
  throw new Error(`${name} not found. Install the Postgres client: brew install libpq`);
}

/**
 * The session pooler, rebuilt from SUPABASE_DB_URL. That variable still names
 * the direct host, which resolves to IPv6 only and times out here; rewriting it
 * is cheaper than keeping a second secret in sync.
 */
function productionUrl() {
  const direct = process.env.SUPABASE_DB_URL;
  if (!direct) throw new Error("SUPABASE_DB_URL missing from .env.local");
  const match = direct.match(/^postgresql:\/\/postgres:([^@]+)@db\.([a-z0-9]+)\.supabase\.co/);
  if (!match) return direct; // already a pooler URL, or something bespoke
  const [, password, ref] = match;
  return `postgresql://postgres.${ref}:${password}@aws-1-eu-west-2.pooler.supabase.com:5432/postgres`;
}

function psql(url, args, options = {}) {
  return execFileSync(pgBin("psql"), ["--quiet", "-v", "ON_ERROR_STOP=1", url, ...args], {
    encoding: "utf8",
    stdio: options.stdio ?? ["ignore", "pipe", "inherit"],
    maxBuffer: 1024 * 1024 * 256,
  });
}

function query(url, sql) {
  return psql(url, ["-Atc", sql]).trim();
}

/**
 * pg_dump 18 writes \restrict / \unrestrict guards that only psql 18 knows.
 * Stripping them keeps the file loadable by whatever psql is nearest.
 */
function stripRestrict(sql) {
  return sql
    .split("\n")
    .filter((line) => !/^\\(un)?restrict\b/.test(line))
    .join("\n");
}

function banner(text) {
  return `--\n-- ${text}\n-- Generated by scripts/db-local.mjs — do not hand-edit.\n--\n\n`;
}

function sync() {
  loadEnv();
  const url = productionUrl();
  fs.mkdirSync(localDir, { recursive: true });

  const version = query(url, "select version()").split(" ").slice(0, 2).join(" ");
  console.log(`reading production (${version})`);

  // 010 — shape.
  const schema = execFileSync(
    pgBin("pg_dump"),
    [url, "--schema-only", "--schema=public", "--no-owner", "--no-privileges", "--no-comments"],
    { encoding: "utf8", maxBuffer: 1024 * 1024 * 256 },
  );
  const schemaPath = path.join(localDir, "010_schema.sql");
  fs.writeFileSync(schemaPath, banner("public schema, as production has it") + stripRestrict(schema));
  console.log(`  010_schema.sql   ${(fs.statSync(schemaPath).size / 1024).toFixed(0)} KB`);

  // 030 — the accounts content points at.
  const ids = new Set();
  for (const [table, column] of CONTENT_AUTHOR_REFS) {
    const rows = query(url, `select distinct ${column}::text from public.${table} where ${column} is not null`);
    for (const id of rows.split("\n").filter(Boolean)) ids.add(id);
  }
  const accounts = [...ids].sort();
  const accountsSql =
    banner("accounts referenced by content, re-created as local sign-ins") +
    "-- Same ids as production so content foreign keys resolve; the emails and\n" +
    "-- the password are local inventions. Password for every account: local-dev\n\n" +
    accounts
      .map(
        (id, index) => `insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000', '${id}', 'authenticated', 'authenticated',
  'author${index + 1}@local.test', crypt('local-dev', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
) on conflict (id) do nothing;`,
      )
      .join("\n\n") +
    "\n";
  fs.writeFileSync(path.join(localDir, "030_accounts.sql"), accountsSql);
  console.log(`  030_accounts.sql ${accounts.length} accounts`);

  // 020 — content.
  const content = execFileSync(
    pgBin("pg_dump"),
    [
      url,
      "--data-only",
      "--no-owner",
      "--no-privileges",
      "--column-inserts",
      "--rows-per-insert=1",
      "--disable-triggers",
      ...CONTENT_TABLES.map((table) => `--table=public.${table}`),
    ],
    { encoding: "utf8", maxBuffer: 1024 * 1024 * 256 },
  );
  const contentPath = path.join(localDir, "020_content.sql");
  fs.writeFileSync(
    contentPath,
    banner("content rows from production — courses, lessons, offers, questions") +
      "-- No personal data lives in these tables. People are invented in 040.\n\n" +
      stripRestrict(content),
  );
  console.log(`  020_content.sql  ${(fs.statSync(contentPath).size / 1024).toFixed(0)} KB`);

  if (!fs.existsSync(path.join(localDir, "040_people.sql"))) {
    console.log("  040_people.sql   missing — hand-written, not generated");
  }
  console.log("\ndone. `npm run db:local:reset` rebuilds the local database from these files.");
}

function assertLocal() {
  let answer;
  try {
    // stderr swallowed: "connection refused" here is an expected answer, not a
    // fault, and `status` phrases it better than libpq does.
    answer = psql(LOCAL_DB_URL, ["-Atc", "select current_setting('port')"], {
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    throw new Error("no database on 127.0.0.1:54322 — start the stack first: supabase start");
  }
  if (answer !== "54322") {
    throw new Error(`127.0.0.1:54322 answered as port ${answer}; refusing to write`);
  }
}

function reset() {
  assertLocal();
  const staged = fs.existsSync(path.join(rootDir, "supabase", "migrations"))
    ? fs
        .readdirSync(path.join(rootDir, "supabase", "migrations"))
        .filter((name) => name.endsWith(".sql"))
        .sort()
    : [];

  console.log("dropping public schema");
  psql(LOCAL_DB_URL, [
    "-c",
    "drop schema if exists public cascade; create schema public; " +
      "grant usage on schema public to anon, authenticated, service_role; " +
      "grant all on schema public to postgres;",
  ]);

  for (const file of ["010_schema.sql", "030_accounts.sql", "020_content.sql", "040_people.sql"]) {
    const full = path.join(localDir, file);
    if (!fs.existsSync(full)) {
      console.log(`  ${file} — absent, skipped`);
      continue;
    }
    console.log(`  ${file}`);
    psql(LOCAL_DB_URL, ["-f", full], { stdio: ["ignore", "ignore", "inherit"] });
  }

  // Last, and against populated tables — see ORDER OF ASSEMBLY above.
  for (const name of staged) {
    console.log(`  pending migration: ${name}`);
    psql(LOCAL_DB_URL, ["-f", path.join(rootDir, "supabase", "migrations", name)], {
      stdio: ["ignore", "ignore", "inherit"],
    });
  }

  for (const view of MATVIEWS) {
    // pg_dump creates matviews unpopulated; anything reading them would error.
    psql(LOCAL_DB_URL, ["-c", `refresh materialized view public.${view};`], {
      stdio: ["ignore", "ignore", "inherit"],
    });
  }

  const courses = query(LOCAL_DB_URL, "select count(*) from public.lms_courses");
  console.log(`\nlocal database rebuilt — ${courses} courses, ${staged.length} pending migration(s) applied`);
}

/**
 * Next loads .env.development.local ahead of .env.local, so writing this file
 * is the whole switch: `npm run dev` then talks to the local stack. Removing it
 * puts dev back on production. Nothing else in the repo has to know.
 */
function env(off) {
  const target = path.join(rootDir, ".env.development.local");
  if (off) {
    if (fs.existsSync(target)) fs.rmSync(target);
    console.log("removed .env.development.local — `npm run dev` is back on production");
    return;
  }
  const status = spawnSync("supabase", ["status", "-o", "env"], { encoding: "utf8" });
  if (status.status !== 0) {
    throw new Error("supabase status failed — is the stack running? `supabase start`");
  }
  const read = (key) => {
    const hit = status.stdout.match(new RegExp(`^${key}="?([^"\\n]+)"?$`, "m"));
    return hit ? hit[1] : null;
  };
  const api = read("API_URL");
  const anon = read("ANON_KEY");
  const service = read("SERVICE_ROLE_KEY");
  if (!api || !anon || !service) throw new Error("could not read keys from supabase status");
  fs.writeFileSync(
    target,
    [
      "# Written by `npm run db:local:env`. Next reads this ahead of .env.local,",
      "# so its presence is what points `npm run dev` at the local stack.",
      "# Remove it (npm run db:local:env:off) to go back to production.",
      `NEXT_PUBLIC_SUPABASE_URL="${api}"`,
      `SUPABASE_URL="${api}"`,
      `NEXT_PUBLIC_SUPABASE_ANON_KEY="${anon}"`,
      `SUPABASE_SERVICE_ROLE_KEY="${service}"`,
      `SUPABASE_DB_URL="${LOCAL_DB_URL}"`,
      'APP_BASE_URL="http://localhost:8000"',
      "",
    ].join("\n"),
  );
  console.log(`wrote .env.development.local -> ${api}`);
  console.log("`npm run dev` now talks to the local stack. Sign in: author1@local.test / local-dev");
}

function status() {
  loadEnv();
  try {
    assertLocal();
    const rows = query(
      LOCAL_DB_URL,
      "select relname||' '||n_live_tup from pg_stat_user_tables where schemaname='public' and n_live_tup>0 order by relname",
    );
    console.log(
      "local stack: up\n" +
        rows
          .split("\n")
          .map((r) => "  " + r)
          .join("\n"),
    );
  } catch (error) {
    console.log(`local stack: down (${error.message})`);
  }
  const on = fs.existsSync(path.join(rootDir, ".env.development.local"));
  console.log(`\nnpm run dev points at: ${on ? "the local stack" : "PRODUCTION"}`);
}

const command = process.argv[2];
try {
  if (command === "sync") sync();
  else if (command === "reset") reset();
  else if (command === "env") env(process.argv.includes("--off"));
  else if (command === "status") status();
  else {
    console.error("usage: node scripts/db-local.mjs <sync|reset|env|status>");
    process.exit(1);
  }
} catch (error) {
  console.error(`\n${error.message}`);
  process.exit(1);
}
