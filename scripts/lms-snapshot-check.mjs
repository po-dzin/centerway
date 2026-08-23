/**
 * Does the git snapshot still match the database?
 *
 * WHY THIS EXISTS. `data/courses/<slug>.json` stopped being the source when the
 * builder shipped: `liveCatalog` reads the row and keeps the file underneath as
 * the last known good copy, served when the row is absent or the read fails.
 * That is a good design with one hole — the file goes stale in silence. Nothing
 * announces the drift, and the day it matters is the day the database does not
 * answer, which is the worst possible moment to discover that the fallback is a
 * month behind.
 *
 * So the drift gets a gate. This does not fix anything: it compares, names what
 * diverged, and fails. The fix is `npm run lms:pull -- <slug>`, which is one
 * command and belongs in the hands of whoever published.
 *
 * NO CREDENTIALS, NO VERDICT. A check that cannot read the database has nothing
 * to say, and saying "PASS" would be worse than saying nothing — so it reports
 * SKIP and exits clean. A job that genuinely has the keys passes `--require-db`
 * and turns a missing key into a failure of its own.
 *
 * NOT IN `lms:qa` YET, and deliberately. The snapshots are already adrift the
 * day this lands, so wiring it into the shared gate would fail every run for
 * everyone until someone pulls. Clear the drift first, then add it — the check
 * is worth nothing as a step people learn to ignore.
 *
 * Usage:
 *   npm run lms:snapshot:check
 *   npm run lms:snapshot:check -- --require-db
 */

import path from "node:path";

import { courseFromRows, preserveFileAnnotations } from "../src/lib/lms/authoring.ts";
import { db, listCourseFiles, readCourseFile, rootDir } from "./lib/lms-cli.mjs";

const requireDb = process.argv.includes("--require-db");

/** Same serialisation `writeCourseFile` uses, so equality means "pull is a no-op". */
function canonical(course) {
  return JSON.stringify(course, null, 2);
}

/**
 * What diverged, in the words of someone deciding whether it matters.
 *
 * Counts first, because "a lesson was added in the builder and never pulled" is
 * the common case and the one that changes what a learner would be served. Then
 * the top-level fields by name — `version`, `sortOrder`, a cover, a schedule —
 * since naming them is the difference between a line worth reading and "this
 * file changed". Everything below that collapses to "lesson content": a diff of
 * two lesson bodies is not a line in a CI log.
 */
function describe(fileCourse, dbCourse) {
  const notes = [];
  const lessons = (course) => course.modules.reduce((total, module) => total + module.lessons.length, 0);

  if (fileCourse.modules.length !== dbCourse.modules.length) {
    notes.push(`modules file=${fileCourse.modules.length} db=${dbCourse.modules.length}`);
  }
  if (lessons(fileCourse) !== lessons(dbCourse)) {
    notes.push(`lessons file=${lessons(fileCourse)} db=${lessons(dbCourse)}`);
  }

  const fields = new Set([...Object.keys(fileCourse), ...Object.keys(dbCourse)]);
  fields.delete("modules");
  const changed = [...fields].filter(
    (key) => JSON.stringify(fileCourse[key]) !== JSON.stringify(dbCourse[key]),
  );
  if (changed.length > 0) notes.push(changed.join(", "));

  if (notes.length === 0) notes.push("lesson content");
  return notes.join(" · ");
}

async function main() {
  const files = listCourseFiles();
  if (files.length === 0) {
    console.log("[SKIP] lms:snapshot:check — no snapshots in data/courses");
    return 0;
  }

  let client;
  try {
    client = db();
  } catch (error) {
    if (requireDb) {
      console.error(`[FAIL] lms:snapshot:check — ${error.message}`);
      return 1;
    }
    console.log(`[SKIP] lms:snapshot:check — ${error.message}. Pass --require-db where the keys exist.`);
    return 0;
  }

  const drifted = [];
  const orphaned = [];

  for (const file of files) {
    const fileCourse = readCourseFile(file);
    const slug = fileCourse.slug ?? path.basename(file, ".json");

    const { data: courseRow, error } = await client
      .from("lms_courses")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error) {
      console.error(`[FAIL] lms:snapshot:check — read failed for ${slug}: ${error.message}`);
      return 1;
    }

    if (!courseRow) {
      // Not a failure on its own: the absent-row branch of `liveCatalog` exists
      // precisely so a course present in git and missing from the database
      // still opens for the people who paid for it. It is worth naming, though
      // — it is either a seeding mistake or a retired course whose file nobody
      // deleted, and those want opposite fixes.
      orphaned.push(slug);
      continue;
    }

    const [{ data: modules, error: moduleError }, { data: lessons, error: lessonError }] = await Promise.all([
      client.from("lms_modules").select("*").eq("course_id", courseRow.id),
      client.from("lms_lessons").select("*").eq("course_id", courseRow.id),
    ]);
    if (moduleError || lessonError) {
      console.error(
        `[FAIL] lms:snapshot:check — read failed for ${slug}: ${(moduleError ?? lessonError).message}`,
      );
      return 1;
    }

    const live = preserveFileAnnotations(fileCourse, courseFromRows(courseRow, modules ?? [], lessons ?? []));
    if (canonical(live) !== canonical(fileCourse)) {
      drifted.push({ slug, note: describe(fileCourse, live), file: path.relative(rootDir, file) });
    }
  }

  for (const slug of orphaned) {
    console.log(`  ${slug} — snapshot with no row in the database (seeding mistake, or a retired course)`);
  }

  if (drifted.length === 0) {
    console.log(`\n[PASS] lms:snapshot:check — ${files.length} snapshot(s) match the database`);
    return 0;
  }

  console.error("\n[FAIL] lms:snapshot:check — the git snapshot no longer matches the database\n");
  for (const entry of drifted) {
    console.error(`  ${entry.slug} — ${entry.note}`);
    console.error(`    fix: npm run lms:pull -- ${entry.slug}   (rewrites ${entry.file})`);
  }
  console.error(
    "\n  The file is the fallback `liveCatalog` serves when the database cannot answer.",
  );
  console.error("  Stale, it is a month-old course handed to someone at the worst moment.\n");
  return 1;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(`[FAIL] lms:snapshot:check — ${error.message}`);
    process.exit(1);
  });
