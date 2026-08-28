/**
 * Finds the images in `course-media` that nothing points at, and — when told to
 * — removes them.
 *
 * WHY THERE IS ANYTHING TO SWEEP. Every upload writes a new folder; replacing a
 * cover does not overwrite the old one, because the path is content-addressed
 * by uuid and overwriting a uuid would mean a collision worth hearing about.
 * Deleting a course removes its rows and leaves its pictures. Neither is a bug —
 * they are the price of never overwriting anything — but the bytes are real.
 *
 * ─── The two rules that keep this from being dangerous ─────────────────────
 *
 * 1. GROUND TRUTH IS THE BUCKET, NOT THE LEDGER. `lms_media_assets` records
 *    what this application believes it wrote. A sweeper's job is to find what it
 *    does not believe in: objects older than the ledger, objects left behind by
 *    a write that failed halfway. So the inventory comes from `storage.objects`
 *    and the ledger is only updated afterwards, to record what happened.
 *
 * 2. HISTORY COUNTS AS A REFERENCE. `lms_course_revisions` is append-only so an
 *    author can restore an old version, and a restored version whose images were
 *    swept is a page of broken frames. So an image that was ever saved is kept.
 *    What this collects is what was never saved — uploaded, then replaced before
 *    the author pressed save — and everything belonging to deleted courses,
 *    whose revisions cascaded away with them.
 *
 * ─── And the two that keep it from being wrong ─────────────────────────────
 *
 * A GRACE PERIOD, because an image that has just been uploaded and not yet
 * saved is referenced by nothing at all, and is indistinguishable from an
 * orphan by any query. Seven days by default.
 *
 * A REFUSAL TO SWEEP EVERYTHING. If the reference scan comes back empty while
 * the bucket is not, the likeliest explanation is a broken query, not an empty
 * product — and the difference between those two readings is every picture in
 * the system. It stops.
 *
 * BOTH RULES LIVE IN `src/lib/lms/mediaSweep.ts`, not here. Everything in this
 * file is plumbing where a mistake costs nothing; the decision about what may
 * be deleted is pure and has tests.
 *
 * Usage:
 *   npm run media:sweep                 # report only, changes nothing
 *   npm run media:sweep:apply           # actually remove
 *   node scripts/media-sweep.mjs --apply --grace=30
 *
 * Contract: docs/migration/sql/2026-08-28_lms_media_ledger.sql
 */

import { planSweep } from "../src/lib/lms/mediaSweep.ts";
import { db } from "./lib/lms-cli.mjs";

const BUCKET = "course-media";

const apply = process.argv.includes("--apply");
const graceArg = process.argv.find((item) => item.startsWith("--grace="));
const GRACE_DAYS = graceArg ? Number(graceArg.slice("--grace=".length)) : 7;

if (!Number.isFinite(GRACE_DAYS) || GRACE_DAYS < 0) {
  console.error("media:sweep FAILED — --grace must be a number of days");
  process.exit(1);
}

function mb(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fail(message) {
  console.error(`media:sweep FAILED — ${message}`);
  process.exit(1);
}

const supabase = db();

const [inventory, referenced] = await Promise.all([
  supabase.rpc("lms_media_inventory"),
  supabase.rpc("lms_referenced_media"),
]);

if (inventory.error) fail(`inventory — ${inventory.error.message}`);
if (referenced.error) fail(`references — ${referenced.error.message}`);

const plan = planSweep({
  assets: (inventory.data ?? []).map((row) => ({
    assetKey: row.asset_key,
    objects: row.objects,
    // bigint arrives as a string over PostgREST.
    bytes: Number(row.bytes),
    newest: row.newest,
  })),
  referenced: (referenced.data ?? []).map((row) => row.asset_key),
  graceDays: GRACE_DAYS,
  now: Date.now(),
});

const seen = plan.referenced.length + plan.young.length + plan.collectable.length;
console.log(`bucket       ${seen} assets, ${mb(plan.totalBytes)}`);
console.log(`referenced   ${plan.referenced.length} (live content + version history)`);
console.log(`unreferenced ${plan.young.length + plan.collectable.length}`);
console.log(`  · ${plan.young.length} inside the ${GRACE_DAYS}-day grace period, left alone`);
console.log(`  · ${plan.collectable.length} collectable, ${mb(plan.collectableBytes)}`);

if (plan.refusal) fail(plan.refusal);

if (plan.collectable.length === 0) {
  console.log("\nNothing to collect.");
  process.exit(0);
}

console.log("");
for (const asset of plan.collectable) {
  console.log(`  ${asset.assetKey}  ${mb(asset.bytes)}  ${String(asset.newest).slice(0, 10)}`);
}

if (!apply) {
  console.log(`\nReport only. Re-run with --apply to remove ${mb(plan.collectableBytes)}.`);
  process.exit(0);
}

// Removal is per asset rather than one large batch: a bucket call that fails
// halfway through five hundred paths leaves a state nobody can describe, and
// the sweep is not in a hurry.
let removed = 0;
let freed = 0;

for (const asset of plan.collectable) {
  const { error } = await supabase.storage.from(BUCKET).remove(asset.objects);
  if (error) {
    console.error(`  ! ${asset.assetKey} — ${error.message}`);
    continue;
  }

  // The ledger row survives its objects: what an account once stored is part of
  // how its usage got where it is, and a deleted record cannot explain that.
  const marked = await supabase
    .from("lms_media_assets")
    .update({ swept_at: new Date().toISOString() })
    .eq("asset_key", asset.assetKey)
    .is("swept_at", null);

  if (marked.error) console.error(`  ! ${asset.assetKey} — ledger: ${marked.error.message}`);

  removed += 1;
  freed += asset.bytes;
}

console.log(`\nRemoved ${removed} of ${plan.collectable.length} assets, ${mb(freed)} freed.`);
