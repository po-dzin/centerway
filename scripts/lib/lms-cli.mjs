/**
 * Shared plumbing for the LMS authoring CLIs (seed / import / pull).
 *
 * All three are thin: they read or write a file and hand the payload to
 * `src/lib/lms/authoring.ts`, which is the single write path shared with the
 * builder and the agent. See docs/lms-authoring-pipeline-2026-08-19.md.
 */

import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

export const rootDir = process.cwd();
export const coursesDir = path.join(rootDir, "data", "courses");

/** Local runs keep their credentials in .env.local, CI passes them in the env. */
export function loadEnv() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  const envFile = path.join(rootDir, ".env.local");
  if (fs.existsSync(envFile) && typeof process.loadEnvFile === "function") {
    process.loadEnvFile(envFile);
  }
}

export function db() {
  loadEnv();
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Missing SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

export function readCourseFile(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function listCourseFiles() {
  if (!fs.existsSync(coursesDir)) throw new Error(`lms_cli_missing_dir:${path.relative(rootDir, coursesDir)}`);
  return fs
    .readdirSync(coursesDir)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => path.join(coursesDir, name));
}

/** Writes the git snapshot of a course, preserving the repo's JSON formatting. */
export function writeCourseFile(course) {
  const file = path.join(coursesDir, `${course.slug}.json`);
  fs.writeFileSync(file, `${JSON.stringify(course, null, 2)}\n`, "utf8");
  return path.relative(rootDir, file);
}

export function reportReadiness(slug, blockers) {
  if (blockers.length === 0) {
    console.log(`  ${slug} — ready to publish`);
    return;
  }
  console.log(`  ${slug} — ${blockers.length} blocker(s) before publish:`);
  for (const blocker of blockers.slice(0, 8)) {
    console.log(`    · ${blocker.code} — ${blocker.path}${blocker.detail ? ` — ${blocker.detail}` : ""}`);
  }
  if (blockers.length > 8) console.log(`    · …and ${blockers.length - 8} more`);
}

export function fail(prefix, error) {
  console.error(`${prefix} FAILED — ${error.message}`);
  process.exit(1);
}
