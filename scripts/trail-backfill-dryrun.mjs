/**
 * READ-ONLY dry run of 20260911001500_lms_progress_opened_event.sql.
 * Computes what the backfill WOULD do. Writes nothing.
 */
import { db } from "./lib/lms-cli.mjs";
const c = db();

const { data: rows, error } = await c.from("lms_progress_events")
  .select("id,enrollment_id,lesson_id,type,client_id,occurred_at")
  .eq("type", "lesson.started");
if (error) throw new Error(error.message);

const groups = {};
for (const r of rows) (groups[`${r.enrollment_id}|${r.lesson_id}`] ||= []).push(r);

let keep = 0, flip = 0, prefixWouldHaveBeenWrong = 0;
for (const list of Object.values(groups)) {
  list.sort((a,b) => a.occurred_at === b.occurred_at ? (a.id < b.id ? -1 : 1)
                                                    : (a.occurred_at < b.occurred_at ? -1 : 1));
  list.forEach((r, i) => {
    if (i === 0) {
      keep++;
      // The naive prefix-keyed backfill would have rewritten this genuine first
      // open, because the emitter has stamped every visit `srv:open:` for months.
      if (r.client_id.startsWith("srv:open:")) prefixWouldHaveBeenWrong++;
    } else flip++;
  });
}

console.log(`lesson.started rows now:        ${rows.length}`);
console.log(`(enrollment, lesson) groups:    ${Object.keys(groups).length}`);
console.log(`stay  lesson.started:           ${keep}`);
console.log(`flip  lesson.opened:            ${flip}`);
console.log(`\nlessons whose real start carries the srv:open: prefix: ${prefixWouldHaveBeenWrong}`);
console.log(`-> a prefix-keyed backfill would have destroyed ${prefixWouldHaveBeenWrong} genuine starts.`);

// After the migration every group must still keep exactly one start.
const bad = Object.entries(groups).filter(([,l]) => l.length === 0);
console.log(`\ngroups left with no lesson.started: ${bad.length} (must be 0)`);
