/**
 * Guard: keep src/lms-core cross-platform.
 *
 * The LMS core is the shared brain for the web cabinet today and for a native
 * app / Telegram Mini App later (docs/lms-research-2026-08-15.md §5A). A package
 * boundary would enforce that; this repo is a single npm app, so the boundary is
 * enforced here instead — a folder move to packages/ later stays trivial.
 *
 * Fails when core code reaches for anything a React Native runtime does not have.
 */

import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const coreDir = path.join(rootDir, "src/lms-core");

const errors = [];

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    if (!entry.isFile() || !/\.tsx?$/.test(entry.name)) return [];
    // Test files import the runner and never ship to a native bundle, so they
    // are exempt from the portability rules that govern the core itself.
    if (/\.test\.tsx?$/.test(entry.name)) return [];
    return [full];
  });
}

if (!fs.existsSync(coreDir)) {
  console.error("guard:lms-core — missing src/lms-core");
  process.exit(1);
}

const files = walk(coreDir);

if (files.length === 0) {
  console.error("guard:lms-core — no source files found in src/lms-core");
  process.exit(1);
}

// Imports that would break the moment this code runs outside Next.js.
const forbiddenImportPatterns = [
  { pattern: /from\s+["']react["']/, reason: "React import (core must stay renderer-agnostic)" },
  { pattern: /from\s+["']react-dom/, reason: "react-dom import" },
  { pattern: /from\s+["']next\//, reason: "Next.js import" },
  { pattern: /from\s+["']@\//, reason: "`@/` alias import (core must not depend on app code)" },
  { pattern: /from\s+["']@supabase\//, reason: "Supabase client import (core must not do I/O)" },
  { pattern: /from\s+["']node:/, reason: "Node builtin import (unavailable in React Native)" },
];

// Globals that only exist in a browser or a Node server.
const forbiddenGlobalPatterns = [
  { pattern: /\bdocument\s*\./, reason: "DOM access (`document`)" },
  { pattern: /\bwindow\s*\./, reason: "DOM access (`window`)" },
  { pattern: /\blocalStorage\b/, reason: "browser storage" },
  { pattern: /\bprocess\.env\b/, reason: "process.env (core takes config as arguments)" },
  { pattern: /\bfetch\s*\(/, reason: "network I/O (core must stay pure)" },
];

function isCommentLine(line) {
  const trimmed = line.trim();
  return trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/*");
}

// A .tsx file in the core would mean JSX, i.e. a renderer leaked in.
for (const file of files) {
  const relative = path.relative(rootDir, file);
  if (file.endsWith(".tsx")) {
    errors.push(`${relative}: JSX file in lms-core — renderers belong in src/components`);
  }

  const source = fs.readFileSync(file, "utf8");
  const lines = source.split("\n");

  lines.forEach((line, index) => {
    // Skip comments so documentation may name the forbidden things.
    if (isCommentLine(line)) return;

    for (const { pattern, reason } of forbiddenImportPatterns) {
      if (pattern.test(line)) errors.push(`${relative}:${index + 1}: ${reason}`);
    }
    for (const { pattern, reason } of forbiddenGlobalPatterns) {
      if (pattern.test(line)) errors.push(`${relative}:${index + 1}: ${reason}`);
    }

    // Any dependency other than a relative sibling breaks portability.
    const importMatch = /^\s*(?:import|export)\b[^;]*?from\s+["']([^"']+)["']/.exec(line);
    if (importMatch && !importMatch[1].startsWith(".")) {
      errors.push(
        `${relative}:${index + 1}: non-relative import "${importMatch[1]}" — lms-core must have zero dependencies`
      );
    }
  });
}

if (errors.length > 0) {
  console.error("guard:lms-core FAILED — src/lms-core must stay pure, portable TypeScript:\n");
  for (const error of errors) console.error(`  - ${error}`);
  console.error("\nMove platform-specific code into src/lib or src/components instead.");
  process.exit(1);
}

console.log(`guard:lms-core OK — ${files.length} files, zero dependencies, no platform bindings.`);
