/** READ-ONLY: which accounts generated the telemetry, and which are staff. */
import { db } from "./lib/lms-cli.mjs";
const c = db();
const { data: roles } = await c.from("user_roles").select("*");
console.log("user_roles cols:", Object.keys(roles?.[0] ?? {}).join(", "));
for (const r of roles ?? [])
  console.log("  ", String(r.auth_user_id ?? r.user_id).slice(0,8), "->", r.role ?? JSON.stringify(r));

const { data: enr } = await c.from("lms_enrollments").select("auth_user_id,source,status");
const bySource = {};
for (const e of enr ?? []) bySource[e.source] = (bySource[e.source] ?? 0) + 1;
console.log("\nenrolments by source:", JSON.stringify(bySource));

const { data: ev } = await c.from("lms_progress_events").select("enrollment_id");
const { data: all } = await c.from("lms_enrollments").select("id,auth_user_id,source");
const byUser = {};
for (const e of ev ?? []) {
  const en = all.find(x => x.id === e.enrollment_id);
  const k = `${String(en?.auth_user_id).slice(0,8)} (${en?.source})`;
  byUser[k] = (byUser[k] ?? 0) + 1;
}
console.log("\nprogress events by account:");
for (const [k,v] of Object.entries(byUser).sort((a,b)=>b[1]-a[1])) console.log(`  ${k.padEnd(22)} ${v}`);

const { data: ann } = await c.from("lms_annotations").select("enrollment_id,kind,quote,note,created_at");
console.log("\nall annotations in prod:");
for (const a of ann ?? []) {
  const en = all.find(x => x.id === a.enrollment_id);
  console.log(`  ${String(en?.auth_user_id).slice(0,8)} ${a.kind} quote=${JSON.stringify(a.quote)} note=${JSON.stringify(a.note)} ${a.created_at.slice(0,16)}`);
}
