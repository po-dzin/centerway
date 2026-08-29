/**
 * Reads and sets `public.user_roles.role` — the one role store.
 *
 * It was two until 2026-08-21: `platform_users.role` sat beside it, unsynced,
 * gating one thing (`isStaff()`), and writing the wrong one was a silent no-op.
 * That column is gone (docs/migration/sql/2026-08-21_merge_role_stores.sql), so
 * this script no longer has a second column to reconcile — but it is still the
 * only way to grant a role without opening the SQL console.
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
// Mirrors user_roles' CHECK, which gained `coach` when the stores merged.
const GRANTABLE = new Set(["admin", "support", "coach", "user"]);

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
    .select("auth_user_id, email")
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

function report(email, role) {
  const elevated = ["admin", "support", "coach"].includes((role ?? "").toLowerCase());
  console.log(`  ${elevated ? "✓" : "·"} ${email.padEnd(38)} ${role ?? "(none)"}`);
}

async function list() {
  const { data, error } = await db.from("user_roles").select("user_id, role");
  if (error) fail(error.message);
  const elevated = (data ?? []).filter((r) => ["admin", "support", "coach"].includes((r.role ?? "").toLowerCase()));
  if (!elevated.length) {
    console.log("admin:role — nobody holds admin or support in user_roles.");
    return;
  }
  const { data: users } = await db.from("platform_users").select("auth_user_id, email");
  const byId = new Map((users ?? []).map((u) => [u.auth_user_id, u]));
  console.log(`admin:role — ${elevated.length} elevated account(s):`);
  for (const row of elevated) {
    report(byId.get(row.user_id)?.email ?? row.user_id, row.role);
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
    report(account.email, await gatingRole(account.auth_user_id));
    return;
  }

  const role = nextRole.trim().toLowerCase();
  if (!GRANTABLE.has(role)) fail(`role must be one of ${[...GRANTABLE].join(", ")} (got "${nextRole}")`);

  const { error } = await db
    .from("user_roles")
    .upsert({ user_id: account.auth_user_id, role }, { onConflict: "user_id" });
  if (error) fail(error.message);

  console.log(`admin:role — set ${email} → ${role}`);
  report(account.email, await gatingRole(account.auth_user_id));
  console.log("\n  The header caches the role per tab for 5 minutes; reload after a change.");
}

await main();
