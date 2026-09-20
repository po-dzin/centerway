/**
 * READ-ONLY survey: which real enrollments left a trail worth drawing.
 * Aggregates only — no note text, no emails. Prints counts and dates.
 */
import { db } from "./lib/lms-cli.mjs";
const c = db();

const { data: enr, error: e1 } = await c
  .from("lms_enrollments").select("id,course_id,created_at").limit(500);
if (e1) throw new Error(e1.message);

const { data: ann, error: e2 } = await c
  .from("lms_annotations").select("id,enrollment_id,kind,lesson_id,note,created_at").limit(5000);
if (e2) throw new Error(e2.message);

const { data: ev, error: e3 } = await c
  .from("lms_progress_events").select("enrollment_id,type,lesson_id,occurred_at").limit(20000);
if (e3) throw new Error(e3.message);

const { data: courses } = await c.from("lms_courses").select("id,slug,title");
const bySlug = Object.fromEntries((courses ?? []).map(r => [r.id, r.slug]));

const rows = (enr ?? []).map(en => {
  const a = (ann ?? []).filter(x => x.enrollment_id === en.id);
  const p = (ev ?? []).filter(x => x.enrollment_id === en.id);
  const days = [...new Set(p.map(x => String(x.occurred_at).slice(0,10)))];
  return {
    enrollment: en.id.slice(0,8),
    course: bySlug[en.course_id] ?? "?",
    marks: a.length,
    notes: a.filter(x => x.note && String(x.note).trim()).length,
    events: p.length,
    completed: p.filter(x => x.type === "lesson.completed").length,
    uncompleted: p.filter(x => x.type === "lesson.uncompleted").length,
    activeDays: days.length,
    span: days.length ? `${days.sort()[0]} → ${days[days.length-1]}` : "—",
  };
}).filter(r => r.events > 0 || r.marks > 0)
  .sort((a,b) => (b.marks + b.events) - (a.marks + a.events));

console.log(`enrollments=${enr?.length ?? 0}  annotations=${ann?.length ?? 0}  events=${ev?.length ?? 0}`);
console.table(rows.slice(0, 25));
