#!/usr/bin/env node
/**
 * Regenerates src/lib/db/database.types.ts from the production schema.
 *
 * `supabase gen types --db-url "$SUPABASE_DB_URL"` does not work from this
 * machine: the direct host resolves only to IPv6 (memory: supabase-db-cli-route).
 * The session pooler is IPv4, so the URL is rewritten onto it — same password,
 * user `postgres.<ref>`, host `aws-1-eu-west-2.pooler.supabase.com`.
 *
 * Read-only: introspection only, nothing is written to the database.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const OUT = "src/lib/db/database.types.ts";
const POOLER_HOST = "aws-1-eu-west-2.pooler.supabase.com";

function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    try {
      for (const line of readFileSync(file, "utf8").split("\n")) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
      }
    } catch {
      /* optional */
    }
  }
}

loadEnv();
const direct = process.env.SUPABASE_DB_URL;
if (!direct) {
  console.error("SUPABASE_DB_URL is not set (put it in .env.local)");
  process.exit(1);
}
const m = direct.match(/^postgres(?:ql)?:\/\/([^:]+):([^@]+)@db\.([a-z0-9]+)\.supabase\.co(?::\d+)?\/(.*)$/);
if (!m) {
  console.error("SUPABASE_DB_URL is not the direct db.<ref>.supabase.co form this script rewrites");
  process.exit(1);
}
const [, , password, ref, database] = m;
const pooler = `postgresql://postgres.${ref}:${password}@${POOLER_HOST}:5432/${database}`;

const generated = execFileSync(
  "supabase",
  ["gen", "types", "typescript", "--db-url", pooler, "--schema", "public"],
  { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
);

const header = `/**
 * GENERATED — do not edit. \`npm run db:types\` regenerates this from the
 * production schema (scripts/db-types.mjs). Commit the result with the
 * migration that changed the schema, the same way tokens travel with
 * cw.tokens.json.
 */
`;
writeFileSync(OUT, header + generated);
console.log(`wrote ${OUT}`);
