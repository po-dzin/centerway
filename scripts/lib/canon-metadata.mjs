import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";

export const SOURCE_NAMESPACE = "ReOS/Projects/CenterWay";
export const DEFAULT_CANON_ROOT = "/Users/G/Documents/RAverse/ReOS/Projects/CenterWay";
export const SNAPSHOT_PATH = "data/canon/registry.snapshot.json";
const ROLES = new Set([
  "project",
  "decision",
  "canon",
  "contract",
  "spec",
  "ops",
  "audit",
  "resource",
  "spec+contract",
  "ops+audit",
  "ops+spec",
]);
const AUTHORITIES = new Set(["docs-first", "code-first", "data-first", "mixed"]);
const STATUSES = new Set(["active", "planned", "partial", "snapshot", "superseded", "archived"]);
const REQUIRED = ["uid", "role", "status", "title", "related", "use_case", "authority", "source_of_truth"];
const COLUMNS = ["doc", "role", "authority", "status", "source_of_truth", "implemented_in", "validated_by"];
const EXCLUDED_ANYWHERE = new Set(["node_modules", ".git", "worktrees"]);
const EXCLUDED_ROOT = new Set([
  ".next",
  ".next-dev",
  "dist",
  "build",
  "coverage",
  "output",
  "artifacts",
  "test-results",
]);
function excludedPath(file) {
  const segments = file.split("/");
  return EXCLUDED_ROOT.has(segments[0]) || segments.some((part) => EXCLUDED_ANYWHERE.has(part));
}
const sorted = (values) => [...values].sort();
const has = (object, key) => Object.hasOwn(object, key);

function scalar(value, context) {
  const text = value.trim();
  if (!text) throw new Error(`${context}: empty scalar`);
  if (text.startsWith('"')) {
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed !== "string") throw new Error("not a string");
      return parsed;
    } catch {
      throw new Error(`${context}: invalid quoted scalar`);
    }
  }
  if (text.startsWith("'")) {
    if (!/^'(?:[^']|'')*'$/.test(text)) throw new Error(`${context}: invalid quoted scalar`);
    return text.slice(1, -1).replaceAll("''", "'");
  }
  // This is deliberately a scalar/list format, not a permissive YAML implementation.
  if (/^[\[\]{}&*!|>@%`]/.test(text) || /:\s|\s#/.test(text) || /^(?:null|true|false|~)$/i.test(text)) {
    throw new Error(`${context}: unsupported frontmatter syntax; quote scalar values`);
  }
  return text;
}

export function parseFrontmatter(source, filename = "note") {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  if (lines[0] !== "---") throw new Error(`${filename}: missing frontmatter`);
  const end = lines.indexOf("---", 1);
  if (end < 0) throw new Error(`${filename}: unclosed frontmatter`);
  const metadata = {};
  let listKey;
  for (let i = 1; i < end; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const item = /^  - (.+)$/.exec(line);
    if (item && listKey) {
      metadata[listKey].push(scalar(item[1], `${filename}:${i + 1}`));
      continue;
    }
    const field = /^([a-z][a-z0-9_]*):(?: (.*))?$/.exec(line);
    if (!field) throw new Error(`${filename}:${i + 1}: unsupported frontmatter syntax`);
    const [, key, value] = field;
    if (has(metadata, key)) throw new Error(`${filename}:${i + 1}: duplicate ${key}`);
    listKey = value?.trim() ? undefined : key;
    metadata[key] = listKey ? [] : scalar(value, `${filename}:${i + 1}`);
  }
  return Object.fromEntries(sorted(Object.keys(metadata)).map((key) => [key, metadata[key]]));
}

export function collectFiles(root) {
  const result = [];
  function walk(directory, prefix = "") {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const relative = prefix + entry.name;
      if (excludedPath(relative)) continue;
      if (entry.isDirectory()) walk(path.join(directory, entry.name), relative + "/");
      else if (entry.isFile()) result.push(relative);
    }
  }
  walk(root);
  return sorted(result);
}

export function collectRepoFiles(repoRoot) {
  // Include tracked files and newly created source artifacts, but never missing tracked files.
  let tracked = [];
  try {
    tracked = execFileSync("git", ["ls-files", "-z"], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
      .split("\0")
      .filter(Boolean);
  } catch {
    /* fixture or non-git directory */
  }
  function existingSourceFile(file) {
    const segments = file.split("/");
    if (excludedPath(file)) return false;
    let current = repoRoot;
    try {
      for (const part of segments) {
        current = path.join(current, part);
        if (fs.lstatSync(current).isSymbolicLink()) return false;
      }
      return fs.lstatSync(current).isFile();
    } catch {
      return false;
    }
  }
  return sorted(new Set([...tracked, ...collectFiles(repoRoot)].filter(existingSourceFile)));
}

const normalizeDoc = (doc) => (doc.replace(/\.md$/, "") === "Registry" ? "Реестр" : doc.replace(/\.md$/, ""));

export function parseRegistry(source) {
  const rows = [];
  let inTable = false;
  for (const line of source.split(/\r?\n/)) {
    if (!line.startsWith("|")) {
      inTable = false;
      continue;
    }
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim().replace(/^`(.*)`$/, "$1"));
    if (cells[0] === "doc") {
      if (cells.length !== COLUMNS.length || cells.some((cell, i) => cell !== COLUMNS[i]))
        throw new Error("Реестр: unexpected registry table columns");
      inTable = true;
      continue;
    }
    if (!inTable || cells.every((cell) => /^[-: ]+$/.test(cell))) continue;
    if (cells.length !== COLUMNS.length) throw new Error("Реестр: invalid registry row");
    rows.push(
      Object.fromEntries(COLUMNS.map((column, i) => [column, column === "doc" ? normalizeDoc(cells[i]) : cells[i]])),
    );
  }
  return rows.sort((a, b) => (a.doc < b.doc ? -1 : a.doc > b.doc ? 1 : 0));
}

function internalLinks(source = "") {
  const links = new Set();
  for (const match of source.matchAll(/\[\[([^\]\n]+)\]\]/g)) {
    const target = match[1].split("|")[0].split("#")[0].trim();
    if (!target) continue;
    if (!target.includes("/") || target.startsWith(SOURCE_NAMESPACE + "/")) links.add(target);
  }
  return sorted(links);
}

export function readCanonProjection(canonRoot) {
  const sourceFiles = collectFiles(canonRoot).filter((file) => file.endsWith(".md"));
  const notes = [];
  for (const file of sourceFiles) {
    const source = fs.readFileSync(path.join(canonRoot, file), "utf8");
    const metadata = parseFrontmatter(source, file);
    if (!has(metadata, "role") && !has(metadata, "status")) continue;
    notes.push({
      file,
      metadata,
      sourceHash: createHash("sha256").update(source).digest("hex"),
      internalLinks: internalLinks(source),
    });
  }
  const registry = parseRegistry(fs.readFileSync(path.join(canonRoot, "Реестр.md"), "utf8"));
  return { schemaVersion: 1, sourceNamespace: SOURCE_NAMESPACE, sourceFiles, notes, registry };
}

export const serializeProjection = (projection) => JSON.stringify(projection, null, 2) + "\n";

function globPattern(pattern) {
  let expression = "^";
  for (let i = 0; i < pattern.length; i++) {
    const char = pattern[i];
    if (char === "*" && pattern[i + 1] === "*") {
      i++;
      if (pattern[i + 1] === "/") {
        expression += "(?:.*/)?";
        i++;
      } else expression += ".*";
    } else if (char === "*") expression += "[^/]*";
    else if (char === "?") expression += "[^/]";
    else expression += char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(expression + "$");
}

function parts(value) {
  return (Array.isArray(value) ? value : [value]).flatMap((item) =>
    typeof item === "string"
      ? item
          .split(";")
          .map((part) => part.trim())
          .filter(Boolean)
      : [],
  );
}
const emptyMarker = (value) => ["–", "—", "-"].includes(value);
const comparison = (value) => parts(value).join("; ");

export function validateCanonProjection(projection, { repoRoot, repoFiles, scripts, liveProjection } = {}) {
  const errors = [];
  const fail = (context, message) => errors.push(`${context}: ${message}`);
  if (
    projection?.schemaVersion !== 1 ||
    projection?.sourceNamespace !== SOURCE_NAMESPACE ||
    !Array.isArray(projection?.notes) ||
    !Array.isArray(projection?.registry) ||
    !Array.isArray(projection?.sourceFiles)
  )
    return ["snapshot: invalid projection schema"];
  if (!repoRoot && (!repoFiles || !scripts)) return ["validator: repoRoot or explicit repoFiles and scripts required"];
  repoFiles ??= collectRepoFiles(repoRoot);
  scripts ??= JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8")).scripts;
  if (liveProjection && serializeProjection(projection) !== serializeProjection(liveProjection))
    fail("snapshot", "stale projection or source hash; run npm run docs:canon:sync");
  if (
    projection.sourceFiles.some(
      (file) =>
        typeof file !== "string" || !file.endsWith(".md") || path.isAbsolute(file) || file.split("/").includes(".."),
    )
  )
    return ["snapshot: invalid or unsafe source file path"];
  if (!projection.notes.length || !projection.registry.length) fail("snapshot", "empty canon projection");
  const sourceFiles = new Set(projection.sourceFiles);
  if (sourceFiles.size !== projection.sourceFiles.length) fail("snapshot", "duplicate source file");
  const sourceStems = new Set(projection.sourceFiles.map((file) => normalizeDoc(file.replace(/^.*\//, ""))));
  const notes = new Map();
  const uids = new Set();
  const noteFiles = new Set();
  function checkPaths(value, context) {
    for (const item of parts(value)) {
      if (emptyMarker(item) || item === "этот файл") continue;
      const external = item.startsWith(SOURCE_NAMESPACE + "/");
      const candidate = external ? item.slice(SOURCE_NAMESPACE.length + 1) : item;
      if (path.isAbsolute(candidate) || candidate.split("/").includes("..")) {
        fail(context, `unsafe path ${item}`);
        continue;
      }
      const files = external ? projection.sourceFiles : repoFiles;
      if (!files.some((file) => globPattern(candidate).test(file))) fail(context, `missing path/glob ${item}`);
    }
  }
  for (const note of projection.notes) {
    if (
      !note ||
      typeof note !== "object" ||
      Array.isArray(note) ||
      typeof note.file !== "string" ||
      !note.metadata ||
      typeof note.metadata !== "object" ||
      Array.isArray(note.metadata) ||
      !Array.isArray(note.internalLinks) ||
      note.internalLinks.some((link) => typeof link !== "string")
    ) {
      fail("snapshot", "invalid note shape");
      continue;
    }
    const context = note.file;
    const meta = note.metadata;
    const stem = normalizeDoc(note.file.replace(/^.*\//, ""));
    if (noteFiles.has(note.file)) fail(context, "duplicate note file");
    noteFiles.add(note.file);
    if (notes.has(stem)) fail(context, "duplicate document stem");
    notes.set(stem, note);
    if (!sourceFiles.has(note.file)) fail(context, "note absent from sourceFiles");
    if (!/^[a-f0-9]{64}$/.test(note.sourceHash)) fail(context, "invalid full-source hash");
    const operationalRole = String(meta.role)
      .split("+")
      .some((role) => ["spec", "contract", "ops"].includes(role));
    const requiredFields = operationalRole ? [...REQUIRED, "implemented_in", "validated_by"] : REQUIRED;
    for (const field of requiredFields)
      if (
        !has(meta, field) ||
        (field !== "related" &&
          (!comparison(meta[field]) ||
            (emptyMarker(comparison(meta[field])) && !["implemented_in", "validated_by"].includes(field))))
      )
        fail(context, `missing required metadata ${field}`);
    if (
      operationalRole &&
      !["snapshot", "archived", "superseded"].includes(meta.status) &&
      emptyMarker(comparison(meta.implemented_in))
    )
      fail(context, "operational implemented_in must identify an owner");
    for (const [field, value] of Object.entries(meta))
      if (!(typeof value === "string" || (Array.isArray(value) && value.every((item) => typeof item === "string"))))
        fail(context, `unsupported metadata value ${field}`);
    for (const field of ["uid", "role", "authority", "status", "title", "use_case"])
      if (has(meta, field) && typeof meta[field] !== "string") fail(context, `${field} must be a scalar string`);
    if (has(meta, "related") && !Array.isArray(meta.related)) fail(context, "related must be a scalar list");
    if (!ROLES.has(meta.role)) fail(context, `unknown role ${meta.role}`);
    if (!AUTHORITIES.has(meta.authority)) fail(context, `unknown authority ${meta.authority}`);
    if (!STATUSES.has(meta.status)) fail(context, `unknown status ${meta.status}`);
    if (uids.has(meta.uid)) fail(context, `duplicate uid ${meta.uid}`);
    uids.add(meta.uid);
    for (const field of ["source_of_truth", "implemented_in"])
      if (has(meta, field)) checkPaths(meta[field], `${context}.${field}`);
    // Historical provenance identifies the old source, not a runtime dependency.
    // It may outlive that file's presence in this checkout; only its namespace is enforced.
    for (const breadcrumb of parts(meta.legacy_source)) {
      if (emptyMarker(breadcrumb)) continue;
      if (!/^(?:docs\/legacy\/|docs\/archive\/)/.test(breadcrumb) || breadcrumb.split("/").includes(".."))
        fail(context, `invalid legacy_source namespace ${breadcrumb}`);
    }
    for (const hook of parts(meta.validated_by)) {
      if (emptyMarker(hook)) {
        if (!["snapshot", "archived", "superseded"].includes(meta.status))
          fail(context, "active checks require cmd:, manual: or planned:");
        continue;
      }
      if (/^(?:manual|planned):\s*\S/.test(hook)) continue;
      const command = /^cmd:\s*npm run ([\w:.-]+)(?: -- .+)?$/.exec(hook);
      if (!command) fail(context, `unsupported validated_by hook ${hook}`);
      else if (!has(scripts, command[1])) fail(context, `unknown npm command ${command[1]}`);
    }
    for (const link of new Set([...note.internalLinks, ...internalLinks(JSON.stringify(meta.related))])) {
      const target = link.startsWith(SOURCE_NAMESPACE + "/") ? link.slice(SOURCE_NAMESPACE.length + 1) : link;
      const resolved = target.includes("/")
        ? sourceFiles.has(target.endsWith(".md") ? target : target + ".md")
        : sourceStems.has(normalizeDoc(target));
      if (!resolved) fail(context, `broken internal wikilink [[${link}]]`);
    }
  }
  const registered = new Set();
  for (const row of projection.registry) {
    if (!row || typeof row.doc !== "string") {
      fail("registry", "invalid registry row shape");
      continue;
    }
    const stem = normalizeDoc(row.doc);
    if (registered.has(stem)) fail("registry", `duplicate row ${stem}`);
    registered.add(stem);
    const note = notes.get(stem);
    if (!note) {
      fail("registry", `row has no note ${stem}`);
      continue;
    }
    for (const column of COLUMNS.slice(1))
      if (
        !(
          !has(note.metadata, column) &&
          ["implemented_in", "validated_by"].includes(column) &&
          emptyMarker(comparison(row[column]))
        ) &&
        comparison(row[column]) !== comparison(note.metadata[column])
      )
        fail("registry", `${stem}.${column} differs from frontmatter`);
  }
  for (const [stem, note] of notes)
    if (note.metadata.status === "active" && !registered.has(stem)) fail("registry", `active note missing row ${stem}`);
  return errors;
}
