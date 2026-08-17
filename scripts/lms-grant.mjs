/**
 * Grants course access by hand — for testing, gifts, and cohort imports.
 *
 * A manual grant is simply an enrollment row with source='manual'. The schema
 * already models it, and `ensureEnrollment` returns an existing enrollment
 * before checking entitlement, so the grant needs no payment to exist.
 *
 * NOTE: this writes to whatever database SUPABASE_URL points at — which for
 * local development is the SAME project as production. Grants are intentional
 * and reversible (--revoke), but they are not sandboxed.
 *
 * Usage:
 *   node scripts/lms-grant.mjs --email=you@example.com --course=reset-day
 *   node scripts/lms-grant.mjs --email=you@example.com --course=reset-day --revoke
 *   node scripts/lms-grant.mjs --list
 *
 * The account must have signed in at least once, so that platform_users has a row.
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const rootDir = process.cwd();

function loadEnv() {
  // Mirrors how the other scripts run: values come from .env.local when the
  // shell has not already exported them.
  const envPath = path.join(rootDir, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function arg(name) {
  const hit = process.argv.find((item) => item.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

function has(name) {
  return process.argv.includes(`--${name}`);
}

function fail(message) {
  console.error(`lms:grant FAILED — ${message}`);
  process.exit(1);
}

loadEnv();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  fail("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing (expected in .env.local)");
}

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function list() {
  const { data, error } = await db
    .from("lms_enrollments")
    .select("id, course_id, auth_user_id, source, started_at")
    .order("started_at", { ascending: false });

  if (error) fail(error.message);
  if (!data?.length) {
    console.log("lms:grant — no enrollments yet.");
    return;
  }

  const { data: courses } = await db.from("lms_courses").select("id, slug");
  const slugById = new Map((courses ?? []).map((course) => [course.id, course.slug]));

  const { data: users } = await db.from("platform_users").select("auth_user_id, email");
  const emailById = new Map((users ?? []).map((user) => [user.auth_user_id, user.email]));

  console.log(`lms:grant — ${data.length} enrollment(s):`);
  for (const row of data) {
    const who = emailById.get(row.auth_user_id) ?? row.auth_user_id;
    console.log(`  · ${slugById.get(row.course_id) ?? row.course_id} — ${who} [${row.source}] since ${row.started_at}`);
  }
}

async function resolveAccount(email) {
  const { data, error } = await db
    .from("platform_users")
    .select("auth_user_id, email, role")
    .ilike("email", email)
    .maybeSingle();

  if (error) fail(error.message);
  if (!data) {
    fail(
      `no platform account for "${email}".\n` +
        "The account must sign in to the platform at least once before it can be granted access."
    );
  }
  return data;
}

async function resolveCourse(slug) {
  const { data, error } = await db
    .from("lms_courses")
    .select("id, slug, title, status")
    .eq("slug", slug)
    .maybeSingle();

  if (error) fail(error.message);
  if (!data) fail(`no course with slug "${slug}". Run \`npm run lms:seed\` first.`);
  return data;
}

async function main() {
  if (has("list")) return list();

  const email = arg("email");
  const courseSlug = arg("course");

  if (!email || !courseSlug) {
    fail("usage: --email=<account email> --course=<course slug> [--revoke]  |  --list");
  }

  const account = await resolveAccount(email);
  const course = await resolveCourse(courseSlug);

  if (has("revoke")) {
    // Progress events cascade with the enrollment — revoking is a real reset,
    // not a hidden pause.
    const { error } = await db
      .from("lms_enrollments")
      .delete()
      .eq("course_id", course.id)
      .eq("auth_user_id", account.auth_user_id);

    if (error) fail(error.message);
    console.log(`lms:grant — revoked "${course.slug}" from ${account.email} (progress deleted with it).`);
    return;
  }

  const { data: existing } = await db
    .from("lms_enrollments")
    .select("id, source, started_at")
    .eq("course_id", course.id)
    .eq("auth_user_id", account.auth_user_id)
    .maybeSingle();

  if (existing) {
    console.log(
      `lms:grant — ${account.email} already enrolled in "${course.slug}" ` +
        `[${existing.source}] since ${existing.started_at}. Nothing to do.`
    );
    return;
  }

  const { error } = await db.from("lms_enrollments").insert({
    course_id: course.id,
    auth_user_id: account.auth_user_id,
    source: "manual",
    // Day 1 starts now, matching the "clock starts when you open the course" rule.
    started_at: new Date().toISOString(),
  });

  if (error) fail(error.message);

  console.log(`lms:grant — granted "${course.title}" to ${account.email}.`);
  if (course.status !== "published") {
    // A manual grant is itself the authorisation to preview, so no admin role
    // is needed — see the draft check in src/lib/lms/server.ts.
    console.log(
      `\n  "${course.slug}" is ${course.status}. This manual grant opens the draft for\n` +
        `  this account only; buyers still get "курс ще готується" until it is published.`
    );
  }
  console.log(`\n  Open: /learn/${course.slug}`);
}

main().catch((error) => {
  console.error(`lms:grant FAILED — ${error.message}`);
  process.exit(1);
});
