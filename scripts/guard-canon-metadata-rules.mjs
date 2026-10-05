import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  collectRepoFiles,
  SNAPSHOT_PATH,
  parseFrontmatter,
  readCanonProjection,
  serializeProjection,
  validateCanonProjection,
} from "./lib/canon-metadata.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "centerway-canon-rules-"));
try {
  const canonRoot = path.join(root, "canon");
  fs.mkdirSync(canonRoot);
  const metadata = {
    uid: "fixture-note",
    role: "contract",
    authority: "mixed",
    status: "active",
    title: "Fixture",
    related: ["[[Registry]]"],
    use_case: "Verify metadata",
    source_of_truth: "этот файл; ReOS/Projects/CenterWay/**",
    implemented_in: "src/app/(platform)/**/page.tsx; src/app/(builder)/build/page.tsx; scripts/guard-*.mjs",
    validated_by: "cmd:npm run lint; manual: verify content",
  };
  const frontmatter = (meta) =>
    "---\n" +
    Object.entries(meta)
      .map(([key, value]) =>
        Array.isArray(value)
          ? `${key}:\n${value.map((item) => `  - ${JSON.stringify(item)}`).join("\n")}`
          : `${key}: ${JSON.stringify(value)}`,
      )
      .join("\n") +
    "\n---\n";
  const registryMeta = { ...metadata, uid: "fixture-registry", title: "Registry", related: ["[[Fixture]]"] };
  const columns = ["doc", "role", "authority", "status", "source_of_truth", "implemented_in", "validated_by"];
  const row = (doc, meta) => "| " + columns.map((column) => (column === "doc" ? doc : meta[column])).join(" | ") + " |";
  fs.writeFileSync(
    path.join(canonRoot, "Fixture.md"),
    frontmatter(metadata) + "# Fixture\n[[ReOS/Projects/CenterWay/Реестр|registry]]\n",
  );
  fs.writeFileSync(
    path.join(canonRoot, "Реестр.md"),
    frontmatter(registryMeta) +
      "# Registry\n" +
      row("doc", Object.fromEntries(columns.map((column) => [column, column]))) +
      "\n| --- | --- | --- | --- | --- | --- | --- |\n" +
      row("Fixture", metadata) +
      "\n" +
      row("Registry", registryMeta) +
      "\n",
  );
  const options = {
    repoRoot: root,
    repoFiles: [
      "src/app/(platform)/page.tsx",
      "src/app/(platform)/nested/page.tsx",
      "src/app/(builder)/build/page.tsx",
      "scripts/guard-fixture.mjs",
    ],
    scripts: { lint: "eslint" },
  };
  const clean = readCanonProjection(canonRoot);
  assert.deepEqual(validateCanonProjection(clean, options), [], "clean fixture rejected");
  assert.equal(
    serializeProjection(readCanonProjection(canonRoot)),
    serializeProjection(clean),
    "projection not deterministic",
  );
  let cases = 0;
  function rejects(label, change, expected) {
    const fixture = structuredClone(clean);
    change(fixture);
    const errors = validateCanonProjection(fixture, options);
    assert.ok(
      errors.some((error) => error.includes(expected)),
      `${label} did not fail as expected: ${errors.join("; ")}`,
    );
    cases++;
  }
  rejects(
    "missing path",
    (fixture) => {
      fixture.notes[0].metadata.implemented_in = "src/missing/**";
    },
    "missing path/glob",
  );
  rejects(
    "unknown command",
    (fixture) => {
      fixture.notes[0].metadata.validated_by = "cmd:npm run missing";
    },
    "unknown npm command",
  );
  rejects(
    "unprefixed command",
    (fixture) => {
      fixture.notes[0].metadata.validated_by = "npm run lint";
    },
    "unsupported validated_by",
  );
  rejects(
    "unknown role",
    (fixture) => {
      fixture.notes[0].metadata.role = "reference";
    },
    "unknown role",
  );
  rejects(
    "unknown authority",
    (fixture) => {
      fixture.notes[0].metadata.authority = "implied";
    },
    "unknown authority",
  );
  rejects(
    "unknown status",
    (fixture) => {
      fixture.notes[0].metadata.status = "draft";
    },
    "unknown status",
  );
  rejects(
    "missing metadata",
    (fixture) => {
      delete fixture.notes[0].metadata.use_case;
    },
    "missing required metadata",
  );
  rejects(
    "mismatched registry row",
    (fixture) => {
      fixture.registry[0].role = "ops";
    },
    "differs from frontmatter",
  );
  rejects(
    "missing active row",
    (fixture) => {
      fixture.registry = fixture.registry.filter((row) => row.doc !== "Fixture");
    },
    "active note missing row",
  );
  rejects(
    "broken wikilink",
    (fixture) => {
      fixture.notes[0].internalLinks.push("Absent");
    },
    "broken internal wikilink",
  );
  rejects(
    "missing external path",
    (fixture) => {
      fixture.notes[0].metadata.source_of_truth = "ReOS/Projects/CenterWay/Absent.md";
    },
    "missing path/glob",
  );
  rejects(
    "schema version",
    (fixture) => {
      fixture.schemaVersion = 2;
    },
    "invalid projection schema",
  );
  rejects(
    "duplicate note file",
    (fixture) => {
      fixture.notes.push(structuredClone(fixture.notes[0]));
    },
    "duplicate note file",
  );
  rejects(
    "duplicate uid",
    (fixture) => {
      fixture.notes[1].metadata.uid = fixture.notes[0].metadata.uid;
    },
    "duplicate uid",
  );
  rejects(
    "duplicate registry row",
    (fixture) => {
      fixture.registry.push(structuredClone(fixture.registry[0]));
    },
    "duplicate row",
  );
  rejects(
    "unsafe source path",
    (fixture) => {
      fixture.notes[0].metadata.source_of_truth = "../escape.md";
    },
    "unsafe path",
  );
  rejects(
    "unsafe source file",
    (fixture) => {
      fixture.sourceFiles.push("../escape.md");
    },
    "unsafe source file path",
  );
  rejects(
    "missing operational metadata",
    (fixture) => {
      delete fixture.notes[0].metadata.implemented_in;
    },
    "missing required metadata implemented_in",
  );
  rejects(
    "invalid provenance namespace",
    (fixture) => {
      fixture.notes[0].metadata.legacy_source = "src/missing.ts";
    },
    "invalid legacy_source namespace",
  );
  rejects(
    "nonobject note",
    (fixture) => {
      fixture.notes.push(null);
    },
    "invalid note shape",
  );
  rejects(
    "nonobject metadata",
    (fixture) => {
      fixture.notes[0].metadata = "metadata";
    },
    "invalid note shape",
  );
  rejects(
    "nonstring source file",
    (fixture) => {
      fixture.sourceFiles.push(null);
    },
    "unsafe source file path",
  );
  rejects(
    "nonarray sourceFiles",
    (fixture) => {
      fixture.sourceFiles = null;
    },
    "invalid projection schema",
  );
  rejects(
    "nonstring internal link",
    (fixture) => {
      fixture.notes[0].internalLinks.push(null);
    },
    "invalid note shape",
  );
  rejects(
    "nonobject registry row",
    (fixture) => {
      fixture.registry.push(null);
    },
    "invalid registry row shape",
  );
  rejects(
    "missing related",
    (fixture) => {
      delete fixture.notes[0].metadata.related;
    },
    "missing required metadata related",
  );
  rejects(
    "active operational owner marker",
    (fixture) => {
      fixture.notes[0].metadata.implemented_in = "–";
    },
    "must identify an owner",
  );
  assert.deepEqual(validateCanonProjection(null), ["snapshot: invalid projection schema"], "null projection threw");
  const historical = structuredClone(clean);
  historical.notes[0].metadata.legacy_source = "docs/legacy/no-longer-present.md; docs/archive/no-longer-present.md";
  assert.deepEqual(
    validateCanonProjection(historical, options),
    [],
    "historical provenance wrongly requires existing files",
  );
  for (const role of ["audit", "resource", "canon", "project", "decision"]) {
    const conditional = structuredClone(clean);
    conditional.notes[0].metadata.role = role;
    delete conditional.notes[0].metadata.implemented_in;
    delete conditional.notes[0].metadata.validated_by;
    conditional.registry[0] = { ...conditional.registry[0], role, implemented_in: "–", validated_by: "–" };
    assert.deepEqual(validateCanonProjection(conditional, options), [], `${role} wrongly requires runtime metadata`);
  }
  const bootstrap = structuredClone(clean);
  bootstrap.notes[0].metadata.implemented_in = SNAPSHOT_PATH;
  bootstrap.registry[0].implemented_in = SNAPSHOT_PATH;
  assert.ok(
    validateCanonProjection(bootstrap, options).some((error) => error.includes("missing path/glob")),
    "guard accepted absent snapshot",
  );
  assert.deepEqual(
    validateCanonProjection(bootstrap, { ...options, repoFiles: [...options.repoFiles, SNAPSHOT_PATH] }),
    [],
    "sync bootstrap rejected its output",
  );
  const collectionRoot = path.join(root, "collection");
  fs.mkdirSync(path.join(collectionRoot, "src"), { recursive: true });
  fs.writeFileSync(path.join(collectionRoot, "src", "real.ts"), "source");
  fs.mkdirSync(path.join(collectionRoot, "src/app/(builder)/build"), { recursive: true });
  fs.writeFileSync(path.join(collectionRoot, "src/app/(builder)/build/page.tsx"), "route");
  for (const directory of [
    ".next",
    ".next-dev",
    "output",
    "artifacts",
    "test-results",
    ".claude/worktrees",
    "node_modules",
    "build",
  ]) {
    fs.mkdirSync(path.join(collectionRoot, directory), { recursive: true });
    fs.writeFileSync(path.join(collectionRoot, directory, "generated.ts"), "generated");
  }
  fs.symlinkSync(path.join(collectionRoot, "src", "real.ts"), path.join(collectionRoot, "linked.ts"));
  fs.symlinkSync(path.join(collectionRoot, "src"), path.join(collectionRoot, "linked-directory"));
  assert.deepEqual(
    collectRepoFiles(collectionRoot),
    ["src/app/(builder)/build/page.tsx", "src/real.ts"],
    "generated output or symlink counted as source",
  );
  const stale = structuredClone(clean);
  stale.notes[0].sourceHash = "0".repeat(64);
  assert.ok(
    validateCanonProjection(stale, { ...options, liveProjection: clean }).some((error) =>
      error.includes("stale projection"),
    ),
    "stale hash accepted",
  );
  cases++;
  const original = fs.readFileSync(path.join(canonRoot, "Fixture.md"), "utf8");
  fs.appendFileSync(path.join(canonRoot, "Fixture.md"), "Content changed without metadata changes\n");
  assert.notEqual(
    readCanonProjection(canonRoot).notes[0].sourceHash,
    clean.notes[0].sourceHash,
    "body change did not update source hash",
  );
  fs.writeFileSync(path.join(canonRoot, "Fixture.md"), original);
  for (const syntax of [
    "role: {value: contract}",
    "related: [Fixture]",
    "title: |\n  multiline",
    "role: &alias contract",
    "role: contract\nrole: ops",
    "title: null",
    "related:\n  - [[Fixture]]",
  ]) {
    assert.throws(() => parseFrontmatter(`---\n${syntax}\n---\n`, "unsupported-fixture"), /unsupported|duplicate/);
    cases++;
  }
  const snapshots = structuredClone(clean);
  snapshots.notes[0].metadata.status = "snapshot";
  snapshots.notes[0].metadata.implemented_in = "–";
  snapshots.notes[0].metadata.validated_by = "–";
  snapshots.registry[0] = { ...snapshots.registry[0], status: "snapshot", implemented_in: "–", validated_by: "–" };
  assert.deepEqual(validateCanonProjection(snapshots, options), [], "snapshot note rejected");
  console.log(
    `[guard:canon-metadata-rules] PASS clean fixture, snapshot fixture, ${cases} negative cases, deterministic full-source hashing`,
  );
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
