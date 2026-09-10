#!/usr/bin/env node
/**
 * Regenerates src/lib/db/database.types.ts from the production schema.
 *
 * Read-only: introspection only, nothing is written to the database. Goes
 * through the session pooler (scripts/lib/db-url.mjs).
 *
 * NEEDS DOCKER. `supabase gen types` runs postgres-meta in a container even
 * against a remote database; with no daemon it fails with "error running
 * container". Start OrbStack/Docker first.
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";

import { poolerUrl } from "./lib/db-url.mjs";

const OUT = "src/lib/db/database.types.ts";

let generated;
try {
  generated = execFileSync(
    "supabase",
    ["gen", "types", "typescript", "--db-url", poolerUrl(), "--schema", "public"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] },
  );
} catch (error) {
  // Never let the failure print the command line: it carries the password.
  const stdout = String(error?.stdout ?? "");
  const hint = /running container/.test(stdout) ? " (Docker is not running — supabase gen types needs it)" : "";
  console.error(`supabase gen types failed${hint}: ${stdout.trim() || String(error?.message ?? "").split("\n")[0] || "unknown"}`);
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
