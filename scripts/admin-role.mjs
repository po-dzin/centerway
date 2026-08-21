/**
 * Reads and sets `public.user_roles.role` — the store that actually gates admin.
 *
 * This exists because there was no way to grant admin except by hand in the SQL
 * console, and because this codebase has TWO role columns: `user_roles.role`
 * (what RLS and every server check read) and `platform_users.role` (what parts
 * of the app display). Writing the wrong one is a silent no-op — no error, the
 * surface just stays locked. This script writes the first and REPORTS the
 * second, so a mismatch is visible instead of mysterious.
 *
 * NOTE: writes to whatever SUPABASE_URL points at, which in local development
 * is the same project as production. Granting admin is not sandboxed.
 *
 * Usage:
 *   node scripts/admin-role.mjs --list
 *   node scripts/admin-role.mjs --email=you@example.com
 *   node scripts/admin-role.mjs --email=you@example.com --role=admin
 *   node scripts/admin-role.mjs --email=you@example.com --role=user     # revoke
 *
 * The account must have signed in at least once, so platform_users has a row.
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const rootDir = process.cwd();
const GRANTABLE = new Set(["admin", "support", "user"]);

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

function fail(message) {
  console.error(`admin:role FAILED — ${message}`);
  process.exit(1);
}

loadEnv();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  fail("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing (expected in .env.local)");
}

const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function accountFor(email) {
  const { data, error } = await db
    .from("platform_users")
    .select("auth_user_id, email, role")
    .ilike("email", email)
    .maybeSingle();
  if (error) fail(error.message);
  if (!data) fail(`no platform account for "${email}" — it must sign in once first.`);
  return data;
}

async function gatingRole(authUserId) {
  const { data, error } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", authUserId)
    .maybeSingle();
  if (error) fail(error.message);
  return typeof data?.role === "string" ? data.role : null;
}

/** Both columns side by side: the one that gates, and the one that only displays. */
function report(email, gating, display) {
  const admin = ["admin", "support"].includes((gating ?? "").toLowerCase());
  console.log(`  ${admin ? "✓" : "·"} ${email}`);
  console.log(`      user_roles.role      = ${gating ?? "(none)"}   ← gates the admin surface`);
  console.log(`      platform_users.role  = ${display ?? "(none)"}   ← display only`);
  if (gating && display && gating.toLowerCase() !== display.toLowerCase()) {
    console.log(`      ! the two stores disagree — the gating one wins`);
  }
}

async function list() {
  const { data, error } = await db.from("user_roles").select("user_id, role");
  if (error) fail(error.message);
  const elevated = (data ?? []).filter((r) => ["admin", "support"].includes((r.role ?? "").toLowerCase()));
  if (!elevated.length) {
    console.log("admin:role — nobody holds admin or support in user_roles.");
    return;
  }
  const { data: users } = await db.from("platform_users").select("auth_user_id, email, role");
  const byId = new Map((users ?? []).map((u) => [u.auth_user_id, u]));
  console.log(`admin:role — ${elevated.length} elevated account(s):`);
  for (const row of elevated) {
    const u = byId.get(row.user_id);
    report(u?.email ?? row.user_id, row.role, u?.role);
  }
}

async function main() {
  const email = arg("email");
  if (!email) {
    await list();
    return;
  }

  const account = await accountFor(email);
  const nextRole = arg("role");

  if (!nextRole) {
    console.log(`admin:role — ${email}:`);
    report(account.email, await gatingRole(account.auth_user_id), account.role);
    return;
  }

  const role = nextRole.trim().toLowerCase();
  if (!GRANTABLE.has(role)) fail(`role must be one of ${[...GRANTABLE].join(", ")} (got "${nextRole}")`);

  const { error } = await db
    .from("user_roles")
    .upsert({ user_id: account.auth_user_id, role }, { onConflict: "user_id" });
  if (error) fail(error.message);

  console.log(`admin:role — set ${email} → ${role}`);
  report(account.email, await gatingRole(account.auth_user_id), account.role);
  console.log("\n  The header caches the role per tab for 5 minutes; reload after a change.");
}

await main();
