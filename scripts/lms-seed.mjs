/**
 * Mirrors every authored course under data/courses/** into Postgres.
 *
 * Thin by design: the mapping, the validation and the publish gate all live in
 * `src/lib/lms/authoring.ts`, which is the single write path shared with the
 * builder (H2) and the agent tools (H3). This script only decides *which*
 * files to hand it. See docs/lms-authoring-pipeline-2026-08-19.md.
 *
 * Structure is upserted by the ids declared in the JSON, so re-running is safe
 * and never orphans a learner's progress.
 *
 * Structural validation runs BEFORE this script via `npm run lms:validate`
 * (vitest loads the same files through src/lms-core). Use `npm run lms:seed`
 * to get both.
 *
 * Usage:
 *   npm run lms:seed            # validate, then write
 *   npm run lms:seed:dry
 */

import path from "node:path";

import { writeCourseStructure } from "../src/lib/lms/authoring.ts";
import { courseReadiness } from "../src/lms-core/index.ts";
import { db, fail, listCourseFiles, readCourseFile, reportReadiness, rootDir } from "./lib/lms-cli.mjs";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const files = listCourseFiles();

  if (files.length === 0) {
    console.log("lms:seed — no course files found, nothing to do.");
    return;
  }

  const courses = files.map(readCourseFile);

  console.log(`lms:seed — ${courses.length} course file(s) found:`);
  courses.forEach((course, index) => {
    const lessons = course.modules.reduce((total, module) => total + module.lessons.length, 0);
    console.log(
      `  · ${course.slug} [${course.status}] — ${course.modules.length} module(s), ${lessons} lesson(s)` +
        `  (${path.relative(rootDir, files[index])})`
    );
    reportReadiness(course.slug, courseReadiness(course).blockers);
  });

  if (dryRun) {
    console.log("lms:seed — dry run, nothing written.");
    return;
  }

  const client = db();

  for (const course of courses) {
    const result = await writeCourseStructure(client, course);
    console.log(`lms:seed — wrote ${result.slug}`);
  }

  console.log("lms:seed — done.");
}

main().catch((error) => fail("lms:seed", error));
