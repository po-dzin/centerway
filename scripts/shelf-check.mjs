/**
 * Is anything the business sells missing from the storefront?
 *
 * The same audit the daily cron runs (src/lib/lms/shelfHealth.ts), in the hand
 * of whoever is looking right now. Use it after a contract change — a new
 * validation rule, a tightened ceiling, a renamed field — because that is the
 * change that silently unlists a live course: `listLiveCourses` skips whatever
 * it cannot assemble, and until this existed the only trace was a server log.
 *
 * NO CREDENTIALS, NO VERDICT — the same rule `lms:snapshot:check` follows. A
 * check that cannot read the database has nothing to say, and printing PASS
 * would be worse than printing nothing. Pass `--require-db` in a job that
 * genuinely holds the keys.
 *
 * Usage:
 *   npm run shelf:check
 *   npm run shelf:check -- --require-db
 */

import { auditShelf, formatShelfAudit } from "../src/lib/lms/shelfHealth.ts";
import { loadEnv } from "./lib/lms-cli.mjs";

const requireDb = process.argv.includes("--require-db");

loadEnv();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  if (requireDb) {
    console.error("shelf:check FAILED — no database credentials (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)");
    process.exit(1);
  }
  console.log("shelf:check SKIP — no database credentials in the environment");
  process.exit(0);
}

const audit = await auditShelf();
const report = formatShelfAudit(audit);

if (!report) {
  console.log(`shelf:check OK — ${audit.courses} courses, every published one assembles and every offer is public.`);
  process.exit(0);
}

console.error(report);
console.error("");
console.error(`shelf:check FAILED — ${audit.faults.length} course(s) the storefront cannot show as sold.`);
process.exit(1);
