/**
 * READ-ONLY export of every real reader trail, one JSON file per enrolment,
 * shaped for the "Слід читача" artifact's document store.
 *
 * Identity is never exported: an enrolment becomes the first 8 characters of
 * its id. Nothing a reader wrote leaves the database either — annotations
 * travel as kind, lesson and time only (the page draws their count), and
 * progress events as type, lesson and time (no payload).
 *
 *   node scripts/trail-export-db.mjs <out-dir>
 *
 * Writes <out-dir>/trails/<handle>.json and <out-dir>/meta/snapshot.json.
 */
import fs from "node:fs";
import path from "node:path";
import { db } from "./lib/lms-cli.mjs";

const OUT = process.argv[2];
if (!OUT) throw new Error("trail_export_db: pass an output directory");
const c = db();

const PAGE = 1000;
const all = async (build) => {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
};

const enr = await all(() => c.from("lms_enrollments")
  .select("id,course_id,created_at,source,auth_user_id").order("created_at"));
const roles = await all(() => c.from("user_roles").select("user_id,role"));
const roleOf = Object.fromEntries(roles.map((r) => [r.user_id, r.role]));
const courses = await all(() => c.from("lms_courses").select("id,slug,title,version,schedule"));
const lessons = await all(() => c.from("lms_lessons")
  .select("id,course_id,module_id,slug,title,order,day_index,duration_min"));
const modules = await all(() => c.from("lms_modules").select("id,course_id,title,order"));
const events = await all(() => c.from("lms_progress_events")
  .select("enrollment_id,type,lesson_id,occurred_at").order("occurred_at"));
const annotations = await all(() => c.from("lms_annotations")
  .select("enrollment_id,kind,lesson_id,created_at").order("created_at"));

const group = (rows, key) => rows.reduce((map, row) => {
  (map[row[key]] ??= []).push(row);
  return map;
}, {});
const eventsBy = group(events, "enrollment_id");
const annotationsBy = group(annotations, "enrollment_id");

fs.mkdirSync(path.join(OUT, "trails"), { recursive: true });
fs.mkdirSync(path.join(OUT, "meta"), { recursive: true });

const handles = new Set();
let written = 0;
let eventCount = 0;
for (const e of enr) {
  const ev = eventsBy[e.id] ?? [];
  if (ev.length === 0) continue;
  const handle = e.id.slice(0, 8);
  if (handles.has(handle)) throw new Error(`trail_export_db: handle collision ${handle}`);
  handles.add(handle);

  const course = courses.find((r) => r.id === e.course_id);
  // `order` in prod is per MODULE; the author's sequence is (module order, lesson order).
  const mods = modules.filter((r) => r.course_id === e.course_id)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const modRank = Object.fromEntries(mods.map((m, i) => [m.id, i]));
  const ls = lessons.filter((r) => r.course_id === e.course_id)
    .sort((a, b) => (modRank[a.module_id] ?? 99) - (modRank[b.module_id] ?? 99)
      || (a.order ?? 0) - (b.order ?? 0));

  const trail = {
    handle,
    course: { slug: course?.slug ?? "?", title: course?.title ?? "", version: course?.version ?? null,
      schedule: course?.schedule ?? null },
    enrolledAt: e.created_at,
    source: e.source,
    role: roleOf[e.auth_user_id] ?? "user",
    modules: mods.map((m) => ({ id: m.id, title: m.title, order: m.order })),
    lessons: ls.map((l, i) => ({ id: l.id, slug: l.slug, title: l.title, seq: i + 1,
      moduleId: l.module_id, orderInModule: l.order, dayIndex: l.day_index, durationMin: l.duration_min })),
    events: ev.map(({ type, lesson_id, occurred_at }) => ({ type, lesson_id, occurred_at })),
    annotations: (annotationsBy[e.id] ?? []).map(({ kind, lesson_id, created_at }) => ({ kind, lesson_id, created_at })),
  };
  fs.writeFileSync(path.join(OUT, "trails", `${handle}.json`), JSON.stringify(trail));
  written += 1;
  eventCount += trail.events.length;
  console.log(`${handle}  ${trail.course.slug}  ${trail.role}/${trail.source}  events=${trail.events.length}  marks=${trail.annotations.length}`);
}

const meta = {
  exportedAt: new Date().toISOString(),
  trailCount: written,
  eventCount,
  enrollmentCount: enr.length,
  tables: ["lms_enrollments", "lms_lessons", "lms_modules", "lms_progress_events", "lms_annotations", "user_roles", "lms_courses"],
};
fs.writeFileSync(path.join(OUT, "meta", "snapshot.json"), JSON.stringify(meta));
console.log(`wrote ${written} trails (${eventCount} events) of ${enr.length} enrolments to ${OUT}`);
