/**
 * Seeds authored courses from data/courses/** into Postgres.
 *
 * Content source of truth on H1 is the JSON (git history = content history).
 * The database mirror exists so that:
 *   - progress events have real lesson rows to reference (FK integrity),
 *   - the H2 builder has somewhere to write,
 *   - admin/reporting can join courses like any other domain entity.
 *
 * Structure is upserted by the ids declared in the JSON, so re-running is safe
 * and never orphans a learner's progress.
 *
 * Validation runs BEFORE this script, via `npm run lms:validate` (vitest loads
 * the same files through src/lms-core). Use `npm run lms:seed` to get both.
 *
 * Usage:
 *   npm run lms:seed            # validate, then write
 *   node scripts/lms-seed.mjs --dry-run
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const rootDir = process.cwd();
const coursesDir = path.join(rootDir, "data", "courses");
const dryRun = process.argv.includes("--dry-run");

function readCourses() {
  if (!fs.existsSync(coursesDir)) {
    throw new Error(`lms_seed_missing_dir:${path.relative(rootDir, coursesDir)}`);
  }
  return fs
    .readdirSync(coursesDir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => JSON.parse(fs.readFileSync(path.join(coursesDir, name), "utf8")));
}

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Missing SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

function courseRow(course) {
  return {
    id: course.id,
    slug: course.slug,
    title: course.title,
    program_slug: course.programSlug,
    brand: course.brand,
    locale: course.locale,
    translation_group_id: course.translationGroupId,
    status: course.status,
    version: course.version,
    summary: course.summary ?? null,
    schedule: course.schedule,
    entitlement_product_codes: course.entitlementProductCodes,
  };
}

function moduleRows(course) {
  return course.modules.map((module) => ({
    id: module.id,
    course_id: course.id,
    slug: module.slug,
    title: module.title,
    order: module.order,
    summary: module.summary ?? null,
  }));
}

function lessonRows(course) {
  return course.modules.flatMap((module) =>
    module.lessons.map((lesson) => ({
      id: lesson.id,
      course_id: course.id,
      module_id: module.id,
      slug: lesson.slug,
      title: lesson.title,
      order: lesson.order,
      day_index: lesson.dayIndex ?? null,
      duration_min: lesson.durationMin ?? null,
      summary: lesson.summary ?? null,
      blocks: lesson.blocks,
    }))
  );
}

async function upsert(db, table, rows) {
  if (rows.length === 0) return;
  // `order` is a reserved word; supabase-js quotes column names for us.
  const { error } = await db.from(table).upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`lms_seed_upsert_failed:${table}:${error.message}`);
}

async function main() {
  const courses = readCourses();

  if (courses.length === 0) {
    console.log("lms:seed — no course files found, nothing to do.");
    return;
  }

  console.log(`lms:seed — ${courses.length} course file(s) found:`);
  for (const course of courses) {
    const lessons = lessonRows(course).length;
    console.log(`  · ${course.slug} [${course.status}] — ${course.modules.length} module(s), ${lessons} lesson(s)`);
  }

  if (dryRun) {
    console.log("lms:seed — dry run, nothing written.");
    return;
  }

  const db = client();

  for (const course of courses) {
    await upsert(db, "lms_courses", [courseRow(course)]);
    await upsert(db, "lms_modules", moduleRows(course));
    await upsert(db, "lms_lessons", lessonRows(course));
    console.log(`lms:seed — wrote ${course.slug}`);
  }

  console.log("lms:seed — done.");
}

main().catch((error) => {
  console.error(`lms:seed FAILED — ${error.message}`);
  process.exit(1);
});
