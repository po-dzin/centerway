/**
 * Exports a course from the database back into data/courses/<slug>.json.
 *
 * The mirror image of `lms:seed`, and the half that matters once the builder
 * ships: the database becomes the source of truth and git keeps the reviewable
 * snapshot. Run it after an author edits a course in the cabinet.
 *
 * `reference: true` is a JSON-only flag with no column yet, so it is carried
 * over from the file being replaced — say so out loud when it cannot be.
 *
 * Usage:
 *   npm run lms:pull -- way21
 */

import fs from "node:fs";
import path from "node:path";

import { courseFromRows } from "../src/lib/lms/authoring.ts";
import { coursesDir, db, fail, readCourseFile, writeCourseFile } from "./lib/lms-cli.mjs";

const slug = process.argv.slice(2).find((arg) => !arg.startsWith("--"));

async function main() {
  if (!slug) throw new Error("usage: npm run lms:pull -- <course-slug>");

  const client = db();
  const { data: courseRow, error: courseError } = await client
    .from("lms_courses")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (courseError) throw new Error(`lms_pull_read_failed:${courseError.message}`);
  if (!courseRow) throw new Error(`lms_pull_unknown_course:${slug}`);

  const [{ data: modules, error: moduleError }, { data: lessons, error: lessonError }] = await Promise.all([
    client.from("lms_modules").select("*").eq("course_id", courseRow.id),
    client.from("lms_lessons").select("*").eq("course_id", courseRow.id),
  ]);
  if (moduleError) throw new Error(`lms_pull_read_failed:${moduleError.message}`);
  if (lessonError) throw new Error(`lms_pull_read_failed:${lessonError.message}`);

  const existingFile = path.join(coursesDir, `${slug}.json`);
  const referenceSlugs = fs.existsSync(existingFile)
    ? readCourseFile(existingFile)
        .modules.filter((module) => module.reference === true)
        .map((module) => module.slug)
    : [];
  if (!fs.existsSync(existingFile)) {
    console.log("lms:pull — no local file to carry `reference: true` from; check reference modules by hand.");
  }

  const course = courseFromRows(courseRow, modules ?? [], lessons ?? [], referenceSlugs);
  console.log(`lms:pull — ${course.slug} [${course.status}] → ${writeCourseFile(course)}`);
}

main().catch((error) => fail("lms:pull", error));
