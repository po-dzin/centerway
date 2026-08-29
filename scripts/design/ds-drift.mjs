#!/usr/bin/env node
// ds-drift — the shared design/code divergence probe.
//
// Contract: ds-drift/1. This file is identical in every project that carries
// the design meta-contract; everything project-specific lives in
// `design.drift.json` at the repo root.
//
// It READS. It never writes to the mirror, never regenerates a bundle, never
// pushes to a Claude Design project. Discovering drift and closing drift are
// two different passes on purpose — a probe that also fixes cannot be trusted
// to report honestly what it found.
//
//   node scripts/design/ds-drift.mjs            print the report, exit 0
//   node scripts/design/ds-drift.mjs --write     also write it to reportDir
//   node scripts/design/ds-drift.mjs --gate      exit 1 if any gated pair drifts
//
// The model: every project declares the same three roles.
//
//   code   — what actually ships to the browser
//   mirror — what the Claude Design project holds
//   brief  — what the design document claims the system is
//
// Drift is any disagreement between two of them. Which pairs are gated (a hard
// failure) versus watched (reported only) is a per-project decision recorded in
// the config, not in this file.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const repoRoot = process.cwd();
const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const GATE = args.includes("--gate");
const LIST_CAP = 40;

const configPath = path.join(repoRoot, "design.drift.json");
if (!fs.existsSync(configPath)) {
  console.error("[ds-drift] no design.drift.json at repo root — this project does not carry the design meta-contract yet.");
  process.exit(2);
}
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
if (config.contract !== "ds-drift/1") {
  console.error(`[ds-drift] unsupported contract "${config.contract}" — this script speaks ds-drift/1.`);
  process.exit(2);
}

/* ---------- value normalisation ---------------------------------------- */

const expandHex = (hex) =>
  hex.length === 4 ? "#" + [...hex.slice(1)].map((c) => c + c).join("") : hex.toLowerCase();

const normaliseValue = (raw) =>
  raw
    .trim()
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/#[0-9a-fA-F]{3,8}\b/g, (m) => expandHex(m))
    .replace(/\s*([,()])\s*/g, "$1")
    .replace(/\s+/g, " ")
    .replace(/;+$/, "")
    .trim()
    .toLowerCase();

const normaliseSelector = (raw) =>
  raw.replace(/\s+/g, " ").replace(/\s*([,>{])\s*/g, "$1").replace(/"/g, "'").trim();

/* ---------- readers ----------------------------------------------------- */

const readText = (rel) => fs.readFileSync(path.join(repoRoot, rel), "utf8");

const filesFor = (source) => {
  if (source.paths) return source.paths;
  if (source.dir) {
    const dir = path.join(repoRoot, source.dir);
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".css"))
      .sort()
      .map((f) => path.join(source.dir, f));
  }
  return [source.path];
};

// CSS custom properties, keyed by selector chain so a light-theme override is
// never silently compared against the dark base.
const readCss = (source) => {
  const out = new Map();
  for (const rel of filesFor(source)) {
    const abs = path.join(repoRoot, rel);
    if (!fs.existsSync(abs)) continue;
    const css = fs.readFileSync(abs, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const stack = [];
    let buffer = "";
    for (let i = 0; i < css.length; i += 1) {
      const ch = css[i];
      if (ch === "{") {
        stack.push(normaliseSelector(buffer));
        buffer = "";
      } else if (ch === "}") {
        stack.pop();
        buffer = "";
      } else if (ch === ";") {
        const decl = buffer.trim();
        buffer = "";
        const match = decl.match(/^(--[\w-]+)\s*:\s*([\s\S]+)$/);
        if (!match || stack.length === 0) continue;
        const scope = stack.filter((s) => !s.startsWith("@")).join(" ") || stack.join(" ");
        out.set(`${scope}|${match[1]}`, normaliseValue(match[2]));
      } else {
        buffer += ch;
      }
    }
  }
  return out;
};

// A layered token JSON (name → value maps nested under arbitrary group keys).
const readTokenJson = (source) => {
  const out = new Map();
  const root = JSON.parse(readText(source.path));
  const walk = (node, trail) => {
    if (!node || typeof node !== "object") return;
    for (const [key, value] of Object.entries(node)) {
      if (value && typeof value === "object") walk(value, [...trail, key]);
      else if (key.startsWith("--")) out.set(`${source.scope ?? trail.join(".")}|${key}`, normaliseValue(String(value)));
    }
  };
  walk(root, []);
  return out;
};

// The `colors:` block of a design brief's YAML frontmatter.
const readFrontmatterColors = (source) => {
  const out = new Map();
  const text = readText(source.path);
  const front = text.match(/^---\n([\s\S]*?)\n---/);
  if (!front) return out;
  const block = front[1].match(/^colors:\n([\s\S]*?)(?=^\S)/m);
  if (!block) return out;
  for (const line of block[1].split("\n")) {
    const match = line.match(/^\s+([\w-]+):\s*"?([^"\n]+?)"?\s*$/);
    if (match) out.set(`brief|--${match[1]}`, normaliseValue(match[2]));
  }
  return out;
};

// Every colour literal a prose document commits to.
const readDocHexes = (source) => {
  const out = new Map();
  for (const rel of filesFor(source)) {
    const abs = path.join(repoRoot, rel);
    if (!fs.existsSync(abs)) continue;
    for (const hex of fs.readFileSync(abs, "utf8").matchAll(/#[0-9a-fA-F]{6}\b/g)) {
      out.set(`doc|${expandHex(hex[0])}`, expandHex(hex[0]));
    }
  }
  return out;
};

const READERS = { css: readCss, "token-json": readTokenJson, "frontmatter-colors": readFrontmatterColors, "doc-hexes": readDocHexes };

/* ---------- comparison -------------------------------------------------- */

const tokenName = (key) => key.slice(key.indexOf("|") + 1);
const inScope = (key, pair) => {
  const name = tokenName(key);
  if (pair.only?.length && !pair.only.some((p) => name.startsWith(p))) return false;
  if (pair.ignore?.length && pair.ignore.some((p) => name.startsWith(p))) return false;
  return true;
};

// `tokens` compares name→value. `values` compares the set of values only, for
// pairs where the two sides legitimately use different names for the same ink.
const compare = (pair, left, right) => {
  const mode = pair.mode ?? "tokens";
  const keyOf = (key, map) => (mode === "values" ? map.get(key) : tokenName(key));
  const index = (map) => {
    const out = new Map();
    for (const [key, value] of map) {
      if (!inScope(key, pair)) continue;
      const id = keyOf(key, map);
      if (mode === "values" && pair.valuePattern && !new RegExp(pair.valuePattern).test(id)) continue;
      if (!out.has(id)) out.set(id, new Set());
      out.get(id).add(value);
    }
    return out;
  };
  const a = index(left);
  const b = index(right);
  const onlyInA = [...a.keys()].filter((k) => !b.has(k)).sort();
  const onlyInB = [...b.keys()].filter((k) => !a.has(k)).sort();
  const mismatched = [];
  if (mode === "tokens") {
    for (const [id, values] of a) {
      if (!b.has(id)) continue;
      const other = b.get(id);
      const same = values.size === other.size && [...values].every((v) => other.has(v));
      if (same) continue;
      // A token can differ two ways, and they are not the same finding. Either
      // one side simply carries a value the other never declares — usually a
      // scope the export flattens away — or the two sides hold different values
      // for the same role, which is real disagreement about how the thing looks.
      const aSubsetB = [...values].every((v) => other.has(v));
      const bSubsetA = [...other].every((v) => values.has(v));
      const relation = aSubsetB ? "B adds" : bSubsetA ? "A adds" : "conflict";
      mismatched.push({ id, a: [...values].sort(), b: [...other].sort(), relation });
    }
    mismatched.sort((x, y) => (x.relation === y.relation ? x.id.localeCompare(y.id) : x.relation === "conflict" ? -1 : 1));
  }
  const conflicts = mismatched.filter((m) => m.relation === "conflict");
  return { onlyInA, onlyInB, mismatched, conflicts, sizeA: a.size, sizeB: b.size };
};

/* ---------- run --------------------------------------------------------- */

const loaded = new Map();
const loadSource = (name) => {
  if (loaded.has(name)) return loaded.get(name);
  const source = config.sources[name];
  if (!source) throw new Error(`unknown source "${name}"`);
  const reader = READERS[source.kind];
  if (!reader) throw new Error(`unknown source kind "${source.kind}"`);
  const map = reader(source);
  loaded.set(name, map);
  return map;
};

const results = config.pairs.map((pair) => {
  const left = loadSource(pair.from);
  const right = loadSource(pair.to);
  const diff = compare(pair, left, right);
  const total = diff.onlyInA.length + diff.onlyInB.length + diff.mismatched.length;
  const gateCount = pair.gateOn === "conflict" ? diff.conflicts.length : total;
  return { pair, diff, total, drifted: total > 0, gateFails: Boolean(pair.gate) && gateCount > 0 };
});

const stamp = new Date().toISOString().slice(0, 10);
let commit = "unknown";
try {
  commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: repoRoot }).toString().trim();
} catch { /* not a git checkout */ }

const roleLine = (name) => {
  const source = config.sources[name];
  const where = source.path ?? source.dir ?? (source.paths ?? []).join(", ");
  return `- **${name}** (${source.role ?? "—"}) · \`${where}\``;
};

const capped = (list) => {
  const shown = list.slice(0, LIST_CAP).map((x) => `\`${x}\``).join(" · ");
  const rest = list.length - LIST_CAP;
  return rest > 0 ? `${shown} … +${rest} more` : shown;
};

const lines = [];
lines.push(`# DS drift — ${config.project}`);
lines.push("");
lines.push(`Contract \`${config.contract}\` · generated ${stamp} · commit \`${commit}\``);
lines.push("");
lines.push(`Mirror: ${config.mirror?.project ?? "—"}${config.mirror?.projectId ? ` \`${config.mirror.projectId}\`` : ""}`);
lines.push("");
lines.push("This is a read-only probe. Nothing here has been synced, exported, or pushed.");
lines.push("");
lines.push("## Roles");
lines.push("");
for (const name of Object.keys(config.sources)) lines.push(roleLine(name));
lines.push("");
lines.push("## Summary");
lines.push("");
lines.push("| pair | mode | gate | conflict | one-sided | only in A | only in B | verdict |");
lines.push("|---|---|---|---|---|---|---|---|");
for (const { pair, diff, drifted, gateFails } of results) {
  const oneSided = diff.mismatched.length - diff.conflicts.length;
  lines.push(
    `| ${pair.name} | ${pair.mode ?? "tokens"} | ${pair.gate ? `gated${pair.gateOn === "conflict" ? " (conflict)" : ""}` : "watch"} | ${diff.conflicts.length} | ${oneSided} | ${diff.onlyInA.length} | ${diff.onlyInB.length} | ${gateFails ? "FAIL" : drifted ? "DRIFT" : "clean"} |`
  );
}
lines.push("");

for (const { pair, diff, drifted } of results) {
  lines.push(`## ${pair.name}`);
  lines.push("");
  lines.push(`A = \`${pair.from}\` (${diff.sizeA} entries) · B = \`${pair.to}\` (${diff.sizeB} entries)`);
  if (pair.note) lines.push(`\n${pair.note}`);
  lines.push("");
  if (!drifted) {
    lines.push("Clean.");
    lines.push("");
    continue;
  }
  const oneSided = diff.mismatched.filter((m) => m.relation !== "conflict");
  const table = (title, rows, note) => {
    if (!rows.length) return;
    lines.push(`### ${title} (${rows.length})`);
    lines.push("");
    if (note) { lines.push(note); lines.push(""); }
    lines.push(`| token | A · ${pair.from} | B · ${pair.to} |`);
    lines.push("|---|---|---|");
    for (const row of rows.slice(0, LIST_CAP)) {
      lines.push(`| \`${row.id}\` | ${row.a.map((v) => `\`${v}\``).join(" / ")} | ${row.b.map((v) => `\`${v}\``).join(" / ")} |`);
    }
    if (rows.length > LIST_CAP) lines.push(`\n… +${rows.length - LIST_CAP} more`);
    lines.push("");
  };
  table("Conflict — the two sides disagree about the value", diff.conflicts);
  table("One-sided — one side declares a value the other never does", oneSided,
    "Usually a scope the other side flattens away or does not model. Read before treating as drift.");
  if (diff.onlyInA.length) {
    lines.push(`### Only in A · ${pair.from} (${diff.onlyInA.length})`);
    lines.push("");
    lines.push(capped(diff.onlyInA));
    lines.push("");
  }
  if (diff.onlyInB.length) {
    lines.push(`### Only in B · ${pair.to} (${diff.onlyInB.length})`);
    lines.push("");
    lines.push(capped(diff.onlyInB));
    lines.push("");
  }
}

const report = lines.join("\n") + "\n";
process.stdout.write(report);

if (WRITE && config.reportDir) {
  const dir = path.join(repoRoot, config.reportDir);
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `DS_DRIFT_${stamp}.md`);
  fs.writeFileSync(out, report);
  console.error(`\n[ds-drift] report written to ${path.relative(repoRoot, out)}`);
}

const gatedDrift = results.filter((r) => r.gateFails);
if (GATE && gatedDrift.length) {
  console.error(`\n[ds-drift] FAIL — ${gatedDrift.length} gated pair(s) drifted: ${gatedDrift.map((r) => r.pair.name).join(", ")}`);
  process.exit(1);
}
console.error(`\n[ds-drift] ${results.filter((r) => r.drifted).length}/${results.length} pair(s) drifted. Nothing was synced.`);
