/**
 * Loads a course from any JSON file into the platform — the agent-environment
 * entry point of the authoring pipeline.
 *
 * Unlike `lms:seed` (which mirrors everything under data/courses), this takes
 * one file from anywhere: a draft an agent just assembled from an author's
 * documents, sitting in a scratch directory. It writes through the same
 * `writeCourseStructure` as the builder and the agent tools, then drops a git
 * snapshot into data/courses/ so the change is reviewable as a diff.
 *
 * Usage:
 *   npm run lms:import -- path/to/course.json
 *   npm run lms:import -- path/to/course.json --dry-run
 *   npm run lms:import -- path/to/course.json --no-snapshot
 */

import { writeCourseStructure } from "../src/lib/lms/authoring.ts";
import { courseReadiness } from "../src/lms-core/index.ts";
import { db, fail, readCourseFile, reportReadiness, writeCourseFile } from "./lib/lms-cli.mjs";

const args = process.argv.slice(2);
const file = args.find((arg) => !arg.startsWith("--"));
const dryRun = args.includes("--dry-run");
const snapshot = !args.includes("--no-snapshot");

async function main() {
  if (!file) throw new Error("usage: npm run lms:import -- <file.json> [--dry-run] [--no-snapshot]");

  const course = readCourseFile(file);
  const readiness = courseReadiness(course);

  console.log(`lms:import — ${course.slug} [${course.status}] from ${file}`);
  reportReadiness(course.slug, readiness.blockers);

  if (dryRun) {
    console.log("lms:import — dry run, nothing written.");
    return;
  }

  const result = await writeCourseStructure(db(), course);
  console.log(`lms:import — wrote ${result.slug}: ${result.moduleCount} module(s), ${result.lessonCount} lesson(s)`);

  if (snapshot) console.log(`lms:import — snapshot: ${writeCourseFile(course)}`);
}

main().catch((error) => fail("lms:import", error));
