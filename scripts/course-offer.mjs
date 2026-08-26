/**
 * Reads and writes `public.lms_course_offers` — the price of a course built in
 * the builder.
 *
 * WHY A SCRIPT AND NOT A SCREEN IN THE BUILDER. The price is the OWNER's, not
 * the author's (docs/migration/sql/2026-08-22_lms_course_storefront.sql): an
 * external author who could set it could set their own payout. The table has
 * one policy, admin-only, and the authoring routes hold no grant on it — so
 * there is deliberately no field in the builder that writes here. Until an
 * admin screen exists this script is the surface, and it is honest about what
 * it is: an owner action, taken from the owner's machine.
 *
 * The code is always `course:<slug>` and is never typed by hand — it is built
 * from the slug by the same rule the checkout and the entitlement use
 * (src/lms-core/offerCode.ts). Nothing else can be sold from this table.
 *
 * NOTE: writes to whatever SUPABASE_URL points at, which in local development
 * is the same project as production. Setting a price is not sandboxed.
 *
 * Usage:
 *   node scripts/course-offer.mjs                                  # list every offer
 *   node scripts/course-offer.mjs --slug=my-course                 # show one course
 *   node scripts/course-offer.mjs --slug=my-course --amount=790 --access-days=30
 *   node scripts/course-offer.mjs --slug=my-course --amount=790 --access-lifetime
 *   node scripts/course-offer.mjs --slug=my-course --amount=790 --list-amount=1200 --access-days=90
 *   node scripts/course-offer.mjs --slug=my-course --access-days=60   # change only the term
 *   node scripts/course-offer.mjs --slug=my-course --off            # withdraw the offer
 *
 * THE TERM IS REQUIRED, and that is the point of it being here. An offer with
 * no access rule grants perpetual access to everyone who ever buys it, silently
 * and forever — so a new offer cannot be created without --access-days or
 * --access-lifetime. Existing offers keep whatever they already say.
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const rootDir = process.cwd();

function loadEnv() {
  const envPath = path.join(rootDir, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    if (!process.env[key]) process.env[key] = trimmed.slice(index + 1).trim();
  }
}

function arg(name) {
  const hit = process.argv.find((item) => item.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

function flag(name) {
  return process.argv.includes(`--${name}`);
}

function fail(message) {
  console.error(`admin:offer FAILED — ${message}`);
  process.exit(1);
}

function wholeAmount(raw, label) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) fail(`${label} must be a whole number of hryvnia (got "${raw}")`);
  return value;
}

function wholeDays(raw, label) {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) fail(`${label} must be a whole number of days (got "${raw}")`);
  return value;
}

loadEnv();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  fail("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing (expected in .env.local)");
}

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const offerCode = (slug) => `course:${slug}`;

async function courseFor(slug) {
  const { data, error } = await db
    .from("lms_courses")
    .select("id, slug, title, status, visibility")
    .eq("slug", slug)
    .maybeSingle();
  if (error) fail(error.message);
  if (!data) fail(`no course with slug "${slug}"`);
  return data;
}

function accessLabel(offer) {
  if (!offer) return "";
  if (offer.access_lifetime) return "  ∞ access";
  return offer.access_days ? `  ${offer.access_days}d access` : "  ACCESS TERM MISSING";
}

function report(course, offer) {
  const price = offer
    ? `${offer.amount} ${offer.currency}${offer.list_amount ? ` (quoted ${offer.list_amount})` : ""}${
        offer.active ? "" : " — WITHDRAWN"
      }`
    : "(not for sale)";
  console.log(
    `  ${offer?.active ? "✓" : "·"} ${course.slug.padEnd(28)} ${course.status}/${course.visibility}  ${price}${accessLabel(offer)}`
  );
}

async function offerFor(slug) {
  const { data, error } = await db
    .from("lms_course_offers")
    .select("id, code, amount, list_amount, currency, pixel_content_name, active, access_days, access_lifetime")
    .eq("code", offerCode(slug))
    .maybeSingle();
  if (error) fail(error.message);
  return data ?? null;
}

async function list() {
  const { data: courses, error } = await db
    .from("lms_courses")
    .select("id, slug, title, status, visibility")
    .order("sort_order", { ascending: true });
  if (error) fail(error.message);
  const { data: offers } = await db
    .from("lms_course_offers")
    .select("id, code, amount, list_amount, currency, active, access_days, access_lifetime");
  const byCode = new Map((offers ?? []).map((row) => [row.code, row]));

  console.log(`admin:offer — ${courses?.length ?? 0} course(s):`);
  for (const course of courses ?? []) report(course, byCode.get(offerCode(course.slug)) ?? null);
  console.log("\n  A course sells only when it is published AND listed/unlisted AND has an active offer.");
}

async function main() {
  const slug = arg("slug");
  if (!slug) {
    await list();
    return;
  }

  const course = await courseFor(slug);
  const amountRaw = arg("amount");
  const accessDaysRaw = arg("access-days");
  const lifetime = flag("access-lifetime");
  const off = flag("off");

  if (accessDaysRaw && lifetime) {
    fail("--access-days and --access-lifetime say opposite things; pass one");
  }

  if (!amountRaw && !off && !accessDaysRaw && !lifetime) {
    console.log(`admin:offer — ${slug}:`);
    report(course, await offerFor(slug));
    return;
  }

  if (off) {
    const existing = await offerFor(slug);
    if (!existing) fail(`"${slug}" has no offer to withdraw`);
    // Deactivated, never deleted: the row is the record of what was sold, and
    // orders already filed under this code have to keep resolving.
    const { error } = await db
      .from("lms_course_offers")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) fail(error.message);
    console.log(`admin:offer — withdrew ${offerCode(slug)}`);
    report(course, await offerFor(slug));
    return;
  }

  const existingForTerm = await offerFor(slug);

  // The term, decided before anything is written. An offer that already has one
  // keeps it unless this run says otherwise; a new one must state it, because
  // "unstated" is spelled the same as "forever" everywhere it is later read.
  let accessDays = existingForTerm?.access_days ?? null;
  let accessLifetime = existingForTerm?.access_lifetime ?? false;

  if (lifetime) {
    accessDays = null;
    accessLifetime = true;
  } else if (accessDaysRaw) {
    accessDays = wholeDays(accessDaysRaw, "--access-days");
    accessLifetime = false;
  }

  if (!accessLifetime && !accessDays) {
    fail(
      "no access term. Pass --access-days=N (how many days one purchase buys, counted from the payment) " +
        "or --access-lifetime for an offer sold without an end."
    );
  }

  if (!amountRaw) {
    // Term-only edit: the price stays exactly as it is.
    if (!existingForTerm) fail(`"${slug}" has no offer yet — set a price with --amount in the same call`);
    const { error } = await db
      .from("lms_course_offers")
      .update({ access_days: accessDays, access_lifetime: accessLifetime, updated_at: new Date().toISOString() })
      .eq("id", existingForTerm.id);
    if (error) fail(error.message);
    console.log(`admin:offer — access term updated for ${offerCode(slug)}`);
    report(course, await offerFor(slug));
    return;
  }

  const amount = wholeAmount(amountRaw, "--amount");
  const listRaw = arg("list-amount");
  const listAmount = listRaw ? wholeAmount(listRaw, "--list-amount") : null;
  if (listAmount !== null && listAmount < amount) {
    fail("--list-amount is the struck-through figure; it cannot be lower than what is charged");
  }

  const existing = existingForTerm;
  const payload = {
    course_id: course.id,
    code: offerCode(slug),
    amount,
    list_amount: listAmount,
    currency: "UAH",
    // How long one purchase buys, enforced by lms_enrollments.expires_at. The
    // sentence printed beside the price is a different field on the course
    // (access_note) and is deliberately free to differ.
    access_days: accessDays,
    access_lifetime: accessLifetime,
    // Kept verbatim once set: it is a reporting label in Meta, and renaming it
    // splits one product's history into two lines.
    pixel_content_name: existing?.pixel_content_name ?? course.title,
    active: true,
    updated_at: new Date().toISOString(),
  };

  const { error } = await db.from("lms_course_offers").upsert(payload, { onConflict: "code" });
  if (error) fail(error.message);

  console.log(`admin:offer — ${existing ? "updated" : "created"} ${offerCode(slug)}`);
  report(course, await offerFor(slug));

  if (course.status !== "published" || course.visibility === "hidden") {
    console.log(
      "\n  Priced, but not on sale yet: the course is still " +
        `${course.status}/${course.visibility}. Publish it and set visibility in the builder.`
    );
  }
}

await main();
