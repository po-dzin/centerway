/**
 * READ-ONLY export of real trails for the SymbolField prototype.
 * Identity is never exported: enrollments become an 8-char handle.
 */
import fs from "node:fs";
import { db } from "./lib/lms-cli.mjs";
const c = db();
const OUT = process.argv[2];
const IDS = ["dba64b5f", "5cc5bc15", "54b2b93b", "1f8b3fdb"];

const { data: enr } = await c.from("lms_enrollments").select("id,course_id,created_at,source,auth_user_id");
const { data: roles } = await c.from("user_roles").select("user_id,role");
const roleOf = Object.fromEntries((roles ?? []).map(r => [r.user_id, r.role]));
const picked = (enr ?? []).filter(e => IDS.includes(e.id.slice(0, 8)));

const { data: courses } = await c.from("lms_courses").select("id,slug,title,version,schedule");
const { data: lessons } = await c.from("lms_lessons")
  .select("id,course_id,module_id,slug,title,order,day_index,duration_min");
const { data: modules } = await c.from("lms_modules").select("id,course_id,title,order");

const out = [];
for (const e of picked) {
  const course = (courses ?? []).find(r => r.id === e.course_id);
  // `order` in prod is per-MODULE, not course-wide. The author's true sequence
  // is (module.order, lesson.order) — sorting on lesson.order alone gave 1,1,1,1,1,2…
  const mods = (modules ?? []).filter(r => r.course_id === e.course_id)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const modRank = Object.fromEntries(mods.map((m, i) => [m.id, i]));
  const ls = (lessons ?? []).filter(r => r.course_id === e.course_id)
    .sort((a, b) => (modRank[a.module_id] ?? 99) - (modRank[b.module_id] ?? 99)
                 || (a.order ?? 0) - (b.order ?? 0));
  const { data: ev } = await c.from("lms_progress_events")
    .select("type,lesson_id,occurred_at,payload")
    .eq("enrollment_id", e.id).order("occurred_at", { ascending: true });
  const { data: ann } = await c.from("lms_annotations")
    .select("kind,lesson_id,quote,note,created_at,course_version")
    .eq("enrollment_id", e.id).order("created_at", { ascending: true });
  out.push({
    handle: e.id.slice(0, 8),
    course: { slug: course?.slug, title: course?.title, version: course?.version,
              schedule: course?.schedule ?? null },
    enrolledAt: e.created_at,
    // How the access was granted, and whether the account is staff. Without
    // these two the trail reads as a customer when it is usually a test run.
    source: e.source,
    role: roleOf[e.auth_user_id] ?? "user",
    modules: mods.map(m => ({ id: m.id, title: m.title, order: m.order })),
    lessons: ls.map((l, i) => ({ id: l.id, slug: l.slug, title: l.title,
      seq: i + 1, moduleId: l.module_id, orderInModule: l.order,
      dayIndex: l.day_index, durationMin: l.duration_min })),
    events: ev ?? [],
    annotations: ann ?? [],
  });
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(`wrote ${OUT}`);
for (const t of out) {
  const kinds = {};
  for (const ev of t.events) kinds[ev.type] = (kinds[ev.type] ?? 0) + 1;
  console.log(`${t.handle}  ${t.course.slug}  v${t.course.version}  lessons=${t.lessons.length}  ann=${t.annotations.length}  ${JSON.stringify(kinds)}`);
  console.log(`         schedule=${JSON.stringify(t.course.schedule)}`);
}
