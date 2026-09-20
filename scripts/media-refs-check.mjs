#!/usr/bin/env node
/**
 * Does every picture the database names still exist?
 *
 * WHY THIS HAD TO BE WRITTEN. A course's artwork lives in two places that are
 * updated by two different acts. The FILE is in this repository and moves when
 * somebody re-encodes, renames or deletes it. The PATH is a string in a row,
 * and only a migration moves that. On 2026-08-28 the PNG plates were re-encoded
 * to WebP: the migration rewrote `cover->>'src'`, the commit deleted the
 * originals — and `cover->>'mobileSrc'`, the portrait master the course hero
 * uses on a phone, was in neither. Three published courses served a 404 as
 * their mobile hero for three weeks, and nothing anywhere said so. The
 * migration's own verification query asked the same half-question the UPDATE
 * did, so it reported success over the broken set.
 *
 * That is the class of fault this answers: not «is the row valid» — it is, a
 * string is a string — but «is the thing it points at actually there».
 *
 * WHAT IS CHECKED AND HOW. A repository path (`/cw/…`) is checked against
 * `public/`, because that directory IS what the deployment serves. A remote
 * address is asked for its headers. Everything else — a data URI, a relative
 * path — is reported as unrecognised rather than guessed at.
 *
 * WHAT IS ONLY REPORTED. `lms_course_revisions` is append-only history, and a
 * historical snapshot naming a file that has since been deleted is not a fault
 * in the snapshot. It is counted and named so a restore is not a surprise, and
 * it never fails the run.
 *
 * Usage:
 *   npm run media:check            # every course, revision and lesson
 *   npm run media:check -- --live  # skip history, check only what is served
 */

import fs from "node:fs";
import path from "node:path";

import { db } from "./lib/lms-cli.mjs";

const rootDir = process.cwd();
const publicDir = path.join(rootDir, "public");
const liveOnly = process.argv.includes("--live");

/** Keys whose string value is an address to a picture, in any nested shape. */
const MEDIA_KEY = /(^|[a-z])(src|image|poster|cover|thumb|photo|background)/i;

/**
 * Every media address inside a JSON document, with where it was found.
 *
 * Walks rather than reads known fields on purpose: a cover has two paths, a
 * lesson block has its own, and the next authored shape will have a third. A
 * checker that knows the field names is a checker that misses the field nobody
 * remembered to add to it — which is exactly how this bug survived.
 */
function collect(node, where, sink) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) collect(item, where, sink);
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === "string" && value !== "" && MEDIA_KEY.test(key)) sink.push({ where, key, src: value });
    else collect(value, where, sink);
  }
}

/** `null` when the address is one this script cannot check. */
async function resolves(src) {
  if (src.startsWith("/")) return fs.existsSync(path.join(publicDir, src.replace(/^\/+/, "")));
  if (!/^https?:\/\//.test(src)) return null;
  try {
    const head = await fetch(src, { method: "HEAD" });
    // Some object stores answer HEAD with 405 and the object is there; ask again.
    if (head.status === 405) return (await fetch(src, { method: "GET" })).ok;
    return head.ok;
  } catch {
    return false;
  }
}

async function main() {
  const client = db();

  const [{ data: courses, error: courseError }, { data: lessons, error: lessonError }] = await Promise.all([
    client.from("lms_courses").select("id, slug, cover, pending_content"),
    client.from("lms_lessons").select("id, course_id, slug, blocks"),
  ]);
  if (courseError) throw new Error(`media_check_courses_failed:${courseError.message}`);
  if (lessonError) throw new Error(`media_check_lessons_failed:${lessonError.message}`);

  const slugOf = new Map((courses ?? []).map((row) => [row.id, row.slug]));
  const live = [];
  const history = [];

  for (const course of courses ?? []) {
    collect(course.cover, `${course.slug} · обкладинка`, live);
    if (course.pending_content) {
      collect(course.pending_content.cover, `${course.slug} · обкладинка в чернетці`, live);
      collect(course.pending_content.modules, `${course.slug} · уроки в чернетці`, live);
    }
  }
  for (const lesson of lessons ?? []) {
    collect(lesson.blocks, `${slugOf.get(lesson.course_id) ?? lesson.course_id}/${lesson.slug}`, live);
  }

  if (!liveOnly) {
    const { data: revisions, error } = await client
      .from("lms_course_revisions")
      .select("id, course_id, revision_number, content");
    if (error) throw new Error(`media_check_revisions_failed:${error.message}`);
    for (const revision of revisions ?? []) {
      const where = `${slugOf.get(revision.course_id) ?? revision.course_id} · версія №${revision.revision_number}`;
      collect(revision.content, where, history);
    }
  }

  /* One address is checked once however many rows name it — the network cost of
     this script is the number of DISTINCT pictures, not the number of mentions,
     and a shared cover is mentioned by every revision that kept it. */
  const group = (entries) => {
    const map = new Map();
    for (const entry of entries) {
      const list = map.get(entry.src) ?? [];
      list.push(`${entry.where}.${entry.key}`);
      map.set(entry.src, list);
    }
    return map;
  };

  const liveRefs = group(live);
  const historyRefs = group(history);
  const checked = new Map();
  const verdict = async (src) => {
    if (!checked.has(src)) checked.set(src, await resolves(src));
    return checked.get(src);
  };

  const broken = [];
  const unknown = [];
  for (const [src, wheres] of liveRefs) {
    const ok = await verdict(src);
    if (ok === null) unknown.push({ src, wheres });
    else if (!ok) broken.push({ src, wheres });
  }

  const brokenHistory = [];
  for (const [src, wheres] of historyRefs) {
    if (liveRefs.has(src)) continue;
    if ((await verdict(src)) === false) brokenHistory.push({ src, wheres });
  }

  console.log(`media:check — ${liveRefs.size} зображень у живих курсах, чернетках і уроках`);
  for (const entry of unknown) {
    console.log(`  ? ${entry.src} — не вдалося перевірити (${entry.wheres[0]})`);
  }
  if (brokenHistory.length > 0) {
    console.log(
      `  · ${brokenHistory.length} адрес(и) лише в історії версій більше не існує — відновлення буде без фото:`,
    );
    for (const entry of brokenHistory.slice(0, 8)) console.log(`      ${entry.src} — ${entry.wheres[0]}`);
  }
  if (broken.length === 0) {
    console.log("  всі зображення на місці");
    return;
  }
  for (const entry of broken) {
    console.log(`  ✗ ${entry.src}`);
    for (const where of entry.wheres) console.log(`      ${where}`);
  }
  throw new Error(`media_check_broken:${broken.length}`);
}

main().catch((error) => {
  console.error(`media:check FAILED — ${error.message}`);
  process.exit(1);
});
