#!/usr/bin/env node
/**
 * Regenerates src/lib/db/database.types.ts from the production schema.
 *
 * Read-only: introspection only, nothing is written to the database. Goes
 * through the session pooler (scripts/lib/db-url.mjs).
 *
 * `--local` reads the local stack instead (npm run db:local:reset first). That
 * is the form for a branch whose migration production has not seen yet: the
 * local database is production's schema plus the pending migrations, so the
 * types travel in the same commit as the migration that needs them.
 *
 * Uses the pinned native CLI and its postgres-meta process, without Docker.
 * Prepare the local runtime first: npm run db:local:prepare.
 */
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";

import { poolerUrl } from "./lib/db-url.mjs";
import { localCli, localProject, nativeEnv } from "./lib/local-supabase.mjs";

const OUT = "src/lib/db/database.types.ts";
const LOCAL_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const local = process.argv.includes("--local");

let generated;
try {
  if (!existsSync(localCli)) {
    console.error("Prepare the native CLI first: npm run db:local:prepare");
    process.exit(1);
  }
  generated = execFileSync(
    localCli,
    [
      "gen",
      "types",
      "typescript",
      "--db-url",
      local ? LOCAL_DB_URL : poolerUrl(),
      "--schema",
      "public",
      "--workdir",
      localProject,
    ],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
      env: nativeEnv(),
    },
  );
} catch (error) {
  // Never let the failure print the command line: it carries the password.
  const stdout = String(error?.stdout ?? "");
  console.error(`Native Supabase type generation failed: ${error.code ?? error.status ?? "see diagnostics above"}`);
  if (stdout.trim()) console.error(stdout.replace(/postgres(?:ql)?:\/\/\S+/g, "[database URL]"));
  process.exit(1);
}

const header = `/**
 * GENERATED — do not edit. \`npm run db:types\` regenerates this from the
 * production schema (scripts/db-types.mjs). Commit the result with the
 * migration that changed the schema, the same way tokens travel with
 * cw.tokens.json.
 */
`;
writeFileSync(OUT, header + generated);
console.log(`wrote ${OUT}`);
