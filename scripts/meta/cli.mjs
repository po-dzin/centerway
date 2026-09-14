/**
 * Meta Ads from the agent environment — one command, one journal row.
 *
 * Reads are free. Every write goes through `applyWrite()`: it is a dry run
 * unless `--apply` is present, and both the dry run and the real call land in
 * `public.meta_actions` with the request, the response and the error. There is
 * no delete command on purpose — PAUSED is the strongest thing this tool can
 * do to something that exists.
 *
 * Usage (see `npm run meta -- help`):
 *   npm run meta -- whoami
 *   npm run meta -- status
 *   npm run meta -- tree --days=7
 *   npm run meta -- insights --level=adset --since=2026-09-01 --until=2026-09-14
 *   npm run meta -- audiences
 *   npm run meta -- pause 120242755018100560 --apply
 *   npm run meta -- budget 120251060558190560 250 --apply
 *   npm run meta -- audience:create --kind=purchasers --days=180 --name="Покупці 180д" --apply
 *   npm run meta -- lookalike --source=<audience_id> --ratio=0.03 --apply
 *   npm run meta -- campaign:create --name="…" --daily=600 --apply
 *   npm run meta -- adset:create --campaign=<id> --name="…" --ages=35-64 --exclude=<aud,aud> --apply
 *   npm run meta -- video:upload --file=./clip.mp4 --name="…" --apply
 *   npm run meta -- ad:create --adset=<id> --name="…" --video=<video_id> --thumb=<url> --message="…" --headline="…" --link=https://… --apply
 *   npm run meta -- journal --limit=20
 *
 * Budgets are given in UAH; the API takes kopecks. Ceilings: META_DAILY_BUDGET_CAP_UAH
 * per object (default 2000) — above it the write is refused without --force.
 */

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "../lib/lms-cli.mjs";

loadEnv();

const API_VERSION = (process.env.META_GRAPH_API_VERSION || "v26.0").trim();
const TOKEN = (process.env.META_ADS_ACCESS_TOKEN || "").trim();
const ACCOUNT = normalizeAccount(process.env.META_AD_ACCOUNT_ID || "");
const PIXEL_ID = (process.env.META_PIXEL_ID || "").trim();
const PAGE_ID = (process.env.META_PAGE_ID || "109220005242649").trim();
const IG_ACTOR_ID = (process.env.META_INSTAGRAM_ACTOR_ID || "17841403794945854").trim();
const BUDGET_CAP_UAH = Number(process.env.META_DAILY_BUDGET_CAP_UAH || 2000);
const PURCHASE_TYPES = ["offsite_conversion.fb_pixel_purchase", "purchase"];
const ACTOR = process.env.META_CLI_ACTOR || process.env.USER || "cli";

function normalizeAccount(raw) {
  const clean = raw.trim();
  if (!clean) return "";
  return clean.startsWith("act_") ? clean : `act_${clean}`;
}

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (const arg of argv) {
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq === -1) flags[arg.slice(2)] = true;
      else flags[arg.slice(2, eq)] = arg.slice(eq + 1);
    } else positional.push(arg);
  }
  return { positional, flags };
}

function die(message) {
  console.error(`✖ ${message}`);
  process.exit(1);
}

function uah(kopecks) {
  const n = Number(kopecks);
  return Number.isFinite(n) ? n / 100 : 0;
}

function fmt(n, digits = 0) {
  return Number(n || 0).toLocaleString("uk-UA", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return isoDate(d);
}

// ─── Graph API ───────────────────────────────────────────────────────────────

async function graphGet(pathname, params = {}, { all = false } = {}) {
  if (!TOKEN) die("META_ADS_ACCESS_TOKEN is not set");
  const url = new URL(`https://graph.facebook.com/${API_VERSION}/${pathname}`);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    url.searchParams.set(k, typeof v === "string" ? v : JSON.stringify(v));
  }
  url.searchParams.set("access_token", TOKEN);
  const rows = [];
  let next = url.toString();
  while (next) {
    const res = await fetch(next);
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.error) {
      throw new Error(`${pathname}: ${json.error?.message || res.status} (code ${json.error?.code ?? "?"})`);
    }
    if (!all) return json;
    rows.push(...(json.data || []));
    next = json.paging?.next || "";
  }
  return { data: rows };
}

async function graphPost(pathname, body) {
  const url = `https://graph.facebook.com/${API_VERSION}/${pathname}`;
  let res;
  if (body instanceof FormData) {
    body.set("access_token", TOKEN);
    res = await fetch(url, { method: "POST", body });
  } else {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(body)) {
      if (v === undefined || v === null) continue;
      params.set(k, typeof v === "string" ? v : JSON.stringify(v));
    }
    params.set("access_token", TOKEN);
    res = await fetch(url, { method: "POST", body: params });
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) {
    const err = new Error(json.error?.error_user_msg || json.error?.message || `HTTP ${res.status}`);
    err.response = json;
    throw err;
  }
  return json;
}

// ─── Journal ─────────────────────────────────────────────────────────────────

function db() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function journal(row) {
  const client = db();
  if (!client) {
    console.warn("(journal skipped: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing)");
    return;
  }
  const { error } = await client.from("meta_actions").insert({ actor: ACTOR, ...row });
  if (error) console.warn(`(journal write failed: ${error.message})`);
}

/**
 * The single door for writes. `describe` is what a human reads in the journal;
 * `request` is the exact call; `run` performs it.
 */
async function applyWrite({ flags, action, objectType, objectId, describe, request, run }) {
  const apply = flags.apply === true;
  console.log(`${apply ? "▶" : "○"} ${describe}`);
  console.log(`   ${request.method} /${request.path}`);
  if (request.body && !(request.body instanceof FormData)) {
    console.log(`   ${JSON.stringify(request.body)}`);
  }
  if (!apply) {
    console.log("   dry run — add --apply to send");
    await journal({
      action, object_type: objectType, object_id: objectId ?? null,
      params: serializable(request.body), dry_run: true, response: null, error: null,
    });
    return null;
  }
  try {
    const response = await run();
    console.log(`   ✔ ${JSON.stringify(response)}`);
    await journal({
      action, object_type: objectType, object_id: objectId ?? response?.id ?? null,
      params: serializable(request.body), dry_run: false, response, error: null,
    });
    return response;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`   ✖ ${message}`);
    await journal({
      action, object_type: objectType, object_id: objectId ?? null,
      params: serializable(request.body), dry_run: false, response: e?.response ?? null, error: message,
    });
    process.exitCode = 1;
    return null;
  }
}

function serializable(body) {
  if (!body) return null;
  if (body instanceof FormData) {
    const out = {};
    for (const [k, v] of body.entries()) out[k] = typeof v === "string" ? v : `<file ${v.name ?? ""}>`;
    return out;
  }
  return body;
}

// ─── Insight helpers ─────────────────────────────────────────────────────────

function actionValue(row, types) {
  for (const a of row.actions || []) if (types.includes(a.action_type)) return Number(a.value) || 0;
  return 0;
}
function actionMoney(row, types) {
  for (const a of row.action_values || []) if (types.includes(a.action_type)) return Number(a.value) || 0;
  return 0;
}

async function insights(level, since, until, extra = {}) {
  const fields = [
    "campaign_id", "campaign_name", "adset_id", "adset_name", "ad_id", "ad_name",
    "spend", "impressions", "reach", "clicks", "ctr", "cpc", "cpm", "frequency", "actions", "action_values",
  ].join(",");
  const res = await graphGet(`${ACCOUNT}/insights`, {
    level, fields, time_range: { since, until }, limit: "500", ...extra,
  }, { all: true });
  return res.data;
}

function summarize(rows) {
  const s = { spend: 0, impressions: 0, clicks: 0, purchases: 0, value: 0, lpv: 0, ic: 0 };
  for (const r of rows) {
    s.spend += Number(r.spend) || 0;
    s.impressions += Number(r.impressions) || 0;
    s.clicks += Number(r.clicks) || 0;
    s.purchases += actionValue(r, PURCHASE_TYPES);
    s.value += actionMoney(r, PURCHASE_TYPES);
    s.lpv += actionValue(r, ["landing_page_view"]);
    s.ic += actionValue(r, ["offsite_conversion.fb_pixel_initiate_checkout"]);
  }
  return s;
}

function line(s) {
  const cpa = s.purchases ? s.spend / s.purchases : 0;
  const roas = s.spend ? s.value / s.spend : 0;
  return `spend ${fmt(s.spend)} · impr ${fmt(s.impressions)} · clicks ${fmt(s.clicks)} · LPV ${fmt(s.lpv)} · IC ${fmt(s.ic)} · purch ${s.purchases} · CPA ${fmt(cpa)} · ROAS(pixel) ${fmt(roas, 2)}`;
}

async function paidOrders(since, until) {
  const client = db();
  if (!client) return null;
  const { data, error } = await client
    .from("orders")
    .select("amount,status,created_at,campaign,product_code")
    .eq("status", "paid")
    .gte("created_at", `${since}T00:00:00Z`)
    .lte("created_at", `${until}T23:59:59Z`);
  if (error) return null;
  const rows = data || [];
  return {
    count: rows.length,
    revenue: rows.reduce((m, r) => m + (Number(r.amount) || 0), 0),
    attributed: rows.filter((r) => r.campaign).length,
    byCampaign: rows.reduce((m, r) => {
      const k = r.campaign || "(none)";
      m[k] = m[k] || { n: 0, sum: 0 };
      m[k].n += 1; m[k].sum += Number(r.amount) || 0;
      return m;
    }, {}),
  };
}

// ─── Commands ────────────────────────────────────────────────────────────────

const commands = {
  async help() {
    console.log(fs.readFileSync(new URL(import.meta.url)).toString().split("*/")[0].replace(/^\/\*\*\n/, "").replace(/^ \* ?/gm, ""));
  },

  async whoami() {
    const me = await graphGet("me", { fields: "id,name" });
    const dbg = await graphGet("debug_token", { input_token: TOKEN });
    const d = dbg.data || {};
    console.log(`token: ${me.name} (${me.id}) · type ${d.type} · valid ${d.is_valid} · expires ${d.expires_at === 0 ? "never" : d.expires_at}`);
    console.log(`scopes: ${(d.scopes || []).join(", ")}`);
    console.log(`account: ${ACCOUNT} · api ${API_VERSION} · pixel ${PIXEL_ID || "(unset)"} · page ${PAGE_ID} · ig actor ${IG_ACTOR_ID}`);
    const pages = await graphGet("me/accounts", { fields: "id,name,instagram_business_account{username}" }).catch(() => ({ data: [] }));
    console.log(`page assets on this token: ${pages.data?.length ? pages.data.map((p) => `${p.name} (${p.id}) ig=${p.instagram_business_account?.username ?? "-"}`).join("; ") : "none — organic/publishing needs a Page token (see docs/marketing/meta-ads-audit-and-integration-2026-09-09.md §4)"}`);
  },

  async status({ flags }) {
    const acct = await graphGet(ACCOUNT, { fields: "name,account_status,currency,amount_spent,timezone_name" });
    console.log(`${acct.name} · status ${acct.account_status} · ${acct.currency} · lifetime spend ${fmt(uah(acct.amount_spent))} · tz ${acct.timezone_name}`);
    const active = await graphGet(`${ACCOUNT}/campaigns`, { fields: "id,name,effective_status,daily_budget,objective", effective_status: ["ACTIVE"], limit: 100 }, { all: true });
    console.log(`\nactive campaigns: ${active.data.length}`);
    for (const c of active.data) console.log(`  ${c.id} ${c.name} · ${c.objective} · daily ${c.daily_budget ? fmt(uah(c.daily_budget)) : "adset-level"}`);
    const activeAdsets = await graphGet(`${ACCOUNT}/adsets`, { fields: "id,name,campaign_id,daily_budget,effective_status", effective_status: ["ACTIVE"], limit: 100 }, { all: true });
    const dailyTotal = activeAdsets.data.reduce((m, a) => m + uah(a.daily_budget), 0) + active.data.reduce((m, c) => m + uah(c.daily_budget), 0);
    console.log(`active adsets: ${activeAdsets.data.length} · committed daily budget ≈ ${fmt(dailyTotal)} UAH`);

    const today = isoDate(new Date());
    for (const [label, since] of [["today", today], ["yesterday", daysAgo(1)], ["7d", daysAgo(6)], ["30d", daysAgo(29)]]) {
      const until = label === "yesterday" ? since : today;
      const rows = await insights("account", since, until);
      const s = summarize(rows);
      const orders = await paidOrders(since, until);
      const trueRoas = orders && s.spend ? orders.revenue / s.spend : 0;
      console.log(`\n${label.padEnd(9)} ${line(s)}`);
      if (orders) console.log(`          orders(db) ${orders.count} paid · revenue ${fmt(orders.revenue)} · attributed ${orders.attributed} · ROAS(true) ${fmt(trueRoas, 2)}`);
    }

    const client = db();
    if (client) {
      const { data } = await client.from("analytics_meta_daily").select("day,synced_at").order("day", { ascending: false }).limit(1);
      console.log(`\nsync: analytics_meta_daily last day ${data?.[0]?.day ?? "-"} (synced ${data?.[0]?.synced_at ?? "-"})`);
    }
    if (flags.verbose) console.log(JSON.stringify(acct, null, 2));
  },

  async tree({ flags }) {
    const days = Number(flags.days || 7);
    const since = flags.since || daysAgo(days - 1);
    const until = flags.until || isoDate(new Date());
    const onlyActive = flags.all !== true;
    const [campaigns, adsets, ads] = await Promise.all([
      graphGet(`${ACCOUNT}/campaigns`, { fields: "id,name,effective_status,objective,daily_budget,bid_strategy", limit: 200 }, { all: true }),
      graphGet(`${ACCOUNT}/adsets`, { fields: "id,name,campaign_id,effective_status,daily_budget,optimization_goal,targeting{age_min,age_max,genders,geo_locations,custom_audiences,excluded_custom_audiences,publisher_platforms,targeting_automation}", limit: 500 }, { all: true }),
      graphGet(`${ACCOUNT}/ads`, { fields: "id,name,adset_id,effective_status,creative{id}", limit: 500 }, { all: true }),
    ]);
    const [ci, si, ai] = await Promise.all([
      insights("campaign", since, until), insights("adset", since, until), insights("ad", since, until),
    ]);
    const byC = groupBy(ci, "campaign_id"), byS = groupBy(si, "adset_id"), byA = groupBy(ai, "ad_id");
    console.log(`window ${since}..${until}${onlyActive ? " · active or spending only (add --all)" : ""}\n`);
    for (const c of campaigns.data) {
      const cs = summarize(byC[c.id] || []);
      if (onlyActive && c.effective_status !== "ACTIVE" && cs.spend === 0) continue;
      console.log(`■ ${c.id} [${c.effective_status}] ${c.name} · ${c.objective}${c.daily_budget ? ` · CBO ${fmt(uah(c.daily_budget))}/d` : ""}`);
      console.log(`    ${line(cs)}`);
      for (const a of adsets.data.filter((x) => x.campaign_id === c.id)) {
        const ss = summarize(byS[a.id] || []);
        if (onlyActive && a.effective_status !== "ACTIVE" && ss.spend === 0) continue;
        const t = a.targeting || {};
        const tg = `${(t.geo_locations?.countries || []).join("/")} ${t.age_min ?? "?"}-${t.age_max ?? "?"} ${t.genders?.[0] === 2 ? "F" : t.genders?.[0] === 1 ? "M" : "all"}${t.targeting_automation?.advantage_audience ? " adv+" : ""}${t.custom_audiences?.length ? ` +${t.custom_audiences.map((x) => x.name).join(",")}` : ""}${t.excluded_custom_audiences?.length ? ` −${t.excluded_custom_audiences.length}excl` : ""}`;
        console.log(`  ├ ${a.id} [${a.effective_status}] ${a.name} · ${a.optimization_goal}${a.daily_budget ? ` · ${fmt(uah(a.daily_budget))}/d` : ""} · ${tg}`);
        console.log(`  │   ${line(ss)}`);
        for (const ad of ads.data.filter((x) => x.adset_id === a.id)) {
          const as = summarize(byA[ad.id] || []);
          if (onlyActive && ad.effective_status !== "ACTIVE" && as.spend === 0) continue;
          console.log(`  │   · ${ad.id} [${ad.effective_status}] ${ad.name} (creative ${ad.creative?.id ?? "-"}) · ${line(as)}`);
        }
      }
    }
  },

  async insights({ flags }) {
    const level = flags.level || "campaign";
    const since = flags.since || daysAgo(6);
    const until = flags.until || isoDate(new Date());
    const extra = {};
    if (flags.breakdown) extra.breakdowns = flags.breakdown;
    if (flags.daily) extra.time_increment = "1";
    const rows = await insights(level, since, until, extra);
    if (flags.json) { console.log(JSON.stringify(rows, null, 2)); return; }
    rows.sort((a, b) => Number(b.spend) - Number(a.spend));
    for (const r of rows) {
      const name = r.ad_name || r.adset_name || r.campaign_name || level;
      const bd = flags.breakdown ? ` [${flags.breakdown.split(",").map((k) => r[k]).join("/")}]` : "";
      console.log(`${(r.date_start && flags.daily) ? r.date_start + " " : ""}${name.slice(0, 60)}${bd}\n    ${line(summarize([r]))}`);
    }
    console.log(`\nTOTAL ${line(summarize(rows))}`);
  },

  async audiences() {
    const res = await graphGet(`${ACCOUNT}/customaudiences`, { fields: "id,name,subtype,approximate_count_lower_bound,delivery_status,time_updated", limit: 50 }, { all: true });
    for (const a of res.data) console.log(`${a.id} ${a.subtype.padEnd(12)} ~${a.approximate_count_lower_bound ?? "?"}  ${a.name}  (${a.delivery_status?.code === 200 ? "ready" : a.delivery_status?.description})`);
  },

  async journal({ flags }) {
    const client = db();
    if (!client) die("journal needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    const { data, error } = await client.from("meta_actions").select("*").order("created_at", { ascending: false }).limit(Number(flags.limit || 20));
    if (error) die(error.message);
    for (const r of data) console.log(`${r.created_at.slice(0, 16)} ${r.dry_run ? "○" : r.error ? "✖" : "✔"} ${r.actor} ${r.action} ${r.object_type ?? ""} ${r.object_id ?? ""} ${r.error ? "— " + r.error : ""}`);
  },

  async pause({ positional, flags }) { return setStatus(positional[0], "PAUSED", flags); },
  async resume({ positional, flags }) { return setStatus(positional[0], "ACTIVE", flags); },

  async budget({ positional, flags }) {
    const [id, amountRaw] = positional;
    const amount = Number(amountRaw);
    if (!id || !Number.isFinite(amount) || amount <= 0) die("usage: budget <adset_or_campaign_id> <uah_per_day> --apply");
    if (amount > BUDGET_CAP_UAH && flags.force !== true) die(`refused: ${amount} UAH/day is above META_DAILY_BUDGET_CAP_UAH=${BUDGET_CAP_UAH}; add --force if this is deliberate`);
    const obj = await graphGet(id, { fields: "name,daily_budget" });
    const body = { daily_budget: Math.round(amount * 100) };
    return applyWrite({
      flags, action: "budget", objectType: "adset_or_campaign", objectId: id,
      describe: `budget «${obj.name}»: ${fmt(uah(obj.daily_budget))} → ${fmt(amount)} UAH/day`,
      request: { method: "POST", path: id, body },
      run: () => graphPost(id, body),
    });
  },

  async "audience:create"({ flags }) {
    const kind = flags.kind || "purchasers";
    const days = Number(flags.days || 180);
    if (!PIXEL_ID) die("META_PIXEL_ID is not set");
    const name = flags.name || defaultAudienceName(kind, days);
    let filter;
    if (kind === "purchasers") filter = { operator: "and", filters: [{ field: "event", operator: "eq", value: "Purchase" }] };
    else if (kind === "checkout") filter = { operator: "and", filters: [{ field: "event", operator: "eq", value: "InitiateCheckout" }] };
    else if (kind === "visitors") filter = flags.url
      ? { operator: "and", filters: [{ field: "url", operator: "i_contains", value: flags.url }] }
      : { operator: "and", filters: [{ field: "url", operator: "i_contains", value: "" }] };
    else die("kind must be purchasers | checkout | visitors");
    const body = {
      name, subtype: "WEBSITE", prefill: true,
      rule: { inclusions: { operator: "or", rules: [{ event_sources: [{ id: PIXEL_ID, type: "pixel" }], retention_seconds: days * 86400, filter }] } },
    };
    return applyWrite({
      flags, action: "audience:create", objectType: "custom_audience",
      describe: `create website audience «${name}» (${kind}, ${days}d)`,
      request: { method: "POST", path: `${ACCOUNT}/customaudiences`, body },
      run: () => graphPost(`${ACCOUNT}/customaudiences`, body),
    });
  },

  async lookalike({ flags }) {
    if (!flags.source) die("usage: lookalike --source=<audience_id> --ratio=0.03 [--name=…] --apply");
    const ratio = Number(flags.ratio || 0.03);
    const src = await graphGet(String(flags.source), { fields: "name" });
    const name = flags.name || `LAL ${Math.round(ratio * 100)}% — ${src.name}`;
    const body = { name, subtype: "LOOKALIKE", origin_audience_id: String(flags.source), lookalike_spec: { type: "custom_ratio", ratio, country: flags.country || "UA" } };
    return applyWrite({
      flags, action: "lookalike", objectType: "custom_audience",
      describe: `create lookalike «${name}»`,
      request: { method: "POST", path: `${ACCOUNT}/customaudiences`, body },
      run: () => graphPost(`${ACCOUNT}/customaudiences`, body),
    });
  },

  async "campaign:create"({ flags }) {
    if (!flags.name) die("usage: campaign:create --name=… [--daily=600] [--objective=sales|leads|traffic] --apply");
    const objective = { sales: "OUTCOME_SALES", leads: "OUTCOME_LEADS", traffic: "OUTCOME_TRAFFIC" }[flags.objective || "sales"];
    if (!objective) die("objective must be sales | leads | traffic");
    const daily = flags.daily ? Number(flags.daily) : null;
    if (daily && daily > BUDGET_CAP_UAH && flags.force !== true) die(`refused: ${daily} UAH/day above cap ${BUDGET_CAP_UAH}`);
    const body = {
      name: flags.name, objective, status: "PAUSED", special_ad_categories: [],
      buying_type: "AUCTION", bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      ...(daily ? { daily_budget: Math.round(daily * 100) } : {}),
    };
    return applyWrite({
      flags, action: "campaign:create", objectType: "campaign",
      describe: `create campaign «${flags.name}» (${objective}${daily ? `, CBO ${daily} UAH/day` : ", ABO"}) — PAUSED`,
      request: { method: "POST", path: `${ACCOUNT}/campaigns`, body },
      run: () => graphPost(`${ACCOUNT}/campaigns`, body),
    });
  },

  async "adset:create"({ flags }) {
    if (!flags.campaign || !flags.name) die("usage: adset:create --campaign=<id> --name=… [--daily=300] [--ages=35-64] [--gender=female|male|all] [--exclude=id,id] [--include=id,id] [--platforms=instagram,facebook] [--no-advantage] [--event=PURCHASE] --apply");
    if (!PIXEL_ID) die("META_PIXEL_ID is not set");
    const [ageMin, ageMax] = String(flags.ages || "35-64").split("-").map(Number);
    const genders = flags.gender === "male" ? [1] : flags.gender === "all" ? undefined : [2];
    const daily = flags.daily ? Number(flags.daily) : null;
    if (daily && daily > BUDGET_CAP_UAH && flags.force !== true) die(`refused: ${daily} UAH/day above cap ${BUDGET_CAP_UAH}`);
    const targeting = {
      geo_locations: { countries: (flags.countries || "UA").split(",") },
      age_min: ageMin, age_max: ageMax,
      ...(genders ? { genders } : {}),
      ...(flags.platforms ? { publisher_platforms: flags.platforms.split(",") } : {}),
      ...(flags.include ? { custom_audiences: String(flags.include).split(",").map((id) => ({ id })) } : {}),
      ...(flags.exclude ? { excluded_custom_audiences: String(flags.exclude).split(",").map((id) => ({ id })) } : {}),
      targeting_automation: { advantage_audience: flags["no-advantage"] ? 0 : 1 },
    };
    const body = {
      name: flags.name, campaign_id: String(flags.campaign), status: "PAUSED",
      billing_event: "IMPRESSIONS", optimization_goal: "OFFSITE_CONVERSIONS",
      promoted_object: { pixel_id: PIXEL_ID, custom_event_type: flags.event || "PURCHASE" },
      targeting,
      ...(daily ? { daily_budget: Math.round(daily * 100), bid_strategy: "LOWEST_COST_WITHOUT_CAP" } : {}),
    };
    return applyWrite({
      flags, action: "adset:create", objectType: "adset",
      describe: `create adset «${flags.name}» in ${flags.campaign} — PAUSED`,
      request: { method: "POST", path: `${ACCOUNT}/adsets`, body },
      run: () => graphPost(`${ACCOUNT}/adsets`, body),
    });
  },

  async "video:upload"({ flags }) {
    if (!flags.file && !flags.url) die("usage: video:upload --file=./clip.mp4 | --url=https://… [--name=…] --apply");
    const name = flags.name || path.basename(flags.file || flags.url);
    let body;
    if (flags.url) body = { name, file_url: flags.url };
    else {
      const file = path.resolve(flags.file);
      if (!fs.existsSync(file)) die(`no such file: ${file}`);
      body = new FormData();
      body.set("name", name);
      body.set("source", new Blob([fs.readFileSync(file)]), path.basename(file));
    }
    return applyWrite({
      flags, action: "video:upload", objectType: "video",
      describe: `upload video «${name}»`,
      request: { method: "POST", path: `${ACCOUNT}/advideos`, body },
      run: () => graphPost(`${ACCOUNT}/advideos`, body),
    });
  },

  async "ad:create"({ flags }) {
    if (!flags.adset || !flags.name) die("usage: ad:create --adset=<id> --name=… (--creative=<id> | --video=<video_id> --thumb=<image_url> --message=… --headline=… --link=https://…) [--cta=LEARN_MORE] --apply");
    let creativeId = flags.creative ? String(flags.creative) : null;
    if (!creativeId) {
      if (!flags.video || !flags.link || !flags.message) die("a new creative needs --video, --thumb, --message, --headline, --link");
      const creativeBody = {
        name: `${flags.name} — creative`,
        object_story_spec: {
          page_id: PAGE_ID,
          instagram_user_id: IG_ACTOR_ID,
          video_data: {
            video_id: String(flags.video),
            image_url: flags.thumb,
            message: flags.message,
            title: flags.headline,
            call_to_action: { type: flags.cta || "LEARN_MORE", value: { link: flags.link } },
          },
        },
      };
      const created = await applyWrite({
        flags, action: "creative:create", objectType: "creative",
        describe: `create video creative for «${flags.name}»`,
        request: { method: "POST", path: `${ACCOUNT}/adcreatives`, body: creativeBody },
        run: () => graphPost(`${ACCOUNT}/adcreatives`, creativeBody),
      });
      if (!created?.id) { if (flags.apply) return null; creativeId = "<creative_id from the step above>"; }
      else creativeId = created.id;
    }
    const body = { name: flags.name, adset_id: String(flags.adset), status: "PAUSED", creative: { creative_id: creativeId } };
    return applyWrite({
      flags, action: "ad:create", objectType: "ad",
      describe: `create ad «${flags.name}» in adset ${flags.adset} — PAUSED`,
      request: { method: "POST", path: `${ACCOUNT}/ads`, body },
      run: () => graphPost(`${ACCOUNT}/ads`, body),
    });
  },
};

async function setStatus(id, status, flags) {
  if (!id) die(`usage: ${status === "PAUSED" ? "pause" : "resume"} <campaign|adset|ad id> --apply`);
  const obj = await graphGet(id, { fields: "name,effective_status" });
  const body = { status };
  return applyWrite({
    flags, action: status === "PAUSED" ? "pause" : "resume", objectType: "object", objectId: id,
    describe: `${status === "PAUSED" ? "pause" : "activate"} «${obj.name}» (now ${obj.effective_status})`,
    request: { method: "POST", path: id, body },
    run: () => graphPost(id, body),
  });
}

function groupBy(rows, key) {
  const out = {};
  for (const r of rows) (out[r[key]] ||= []).push(r);
  return out;
}

function defaultAudienceName(kind, days) {
  return { purchasers: `Покупці ${days}д (платформа)`, checkout: `Почали оплату ${days}д (платформа)`, visitors: `Відвідувачі ${days}д (платформа)` }[kind] || `${kind} ${days}d`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

const { positional, flags } = parseArgs(process.argv.slice(2));
const [command, ...rest] = positional;
const handler = commands[command || "help"];
if (!handler) die(`unknown command «${command}» — try: npm run meta -- help`);
if (!ACCOUNT && command !== "help") die("META_AD_ACCOUNT_ID is not set");
handler({ positional: rest, flags }).catch((e) => die(e instanceof Error ? e.message : String(e)));
