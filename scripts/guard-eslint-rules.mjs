/**
 * The guards that live in ESLint, checked against violations they must catch.
 *
 * Six architectural rules moved out of `scripts/guard-*.mjs` into
 * `eslint.config.mjs` on 2026-09-11: the lms-core portability boundary, the
 * composition rule for public route files, and the admin's grey palette. A
 * rule expressed as config is easy to break silently — one `files` pattern
 * that stops matching, one block dropped in a merge, and the gate goes green
 * on code it should refuse.
 *
 * So each rule is exercised here the only way a rule can be trusted: write a
 * file that violates it, lint it, and require the complaint. The clean cases
 * matter as much — they are the false positives the line-regex guards used to
 * produce, and the reason for the move.
 *
 * Usage: npm run guard:eslint
 */

import { ESLint } from "eslint";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

/** `expect: null` means the file must lint clean — a false positive is a failure. */
const cases = [
  // --- src/lms-core: zero dependencies -------------------------------------
  {
    name: "lms-core rejects a package import",
    file: "src/lms-core/__guard_probe.ts",
    expect: "zero dependencies",
    code: `import { z } from "zod";\nexport const a = z;\n`,
  },
  {
    name: "lms-core rejects React",
    file: "src/lms-core/__guard_probe.ts",
    expect: "zero dependencies",
    code: `import * as React from "react";\nexport const a = React;\n`,
  },
  {
    name: "lms-core rejects a node builtin",
    file: "src/lms-core/__guard_probe.ts",
    expect: "zero dependencies",
    code: `import fs from "node:fs";\nexport const a = fs;\n`,
  },
  {
    name: "lms-core rejects the @/ alias",
    file: "src/lms-core/__guard_probe.ts",
    expect: "zero dependencies",
    code: `import { env } from "@/lib/env";\nexport const a = env;\n`,
  },
  {
    name: "lms-core rejects a re-export from a package",
    file: "src/lms-core/__guard_probe.ts",
    expect: "zero dependencies",
    code: `export * from "@supabase/supabase-js";\n`,
  },
  {
    name: "lms-core allows a relative sibling",
    file: "src/lms-core/__guard_probe.ts",
    expect: null,
    code: `import { helper } from "./__guard_probe_sibling";\nexport const a = helper;\n`,
    also: { file: "src/lms-core/__guard_probe_sibling.ts", code: `export const helper = 1;\n` },
  },

  // --- src/lms-core: no host globals ---------------------------------------
  {
    name: "lms-core rejects window",
    file: "src/lms-core/__guard_probe.ts",
    expect: "outside a browser",
    code: `export function a() { return window.innerWidth; }\n`,
  },
  {
    name: "lms-core rejects document",
    file: "src/lms-core/__guard_probe.ts",
    expect: "outside a browser",
    code: `export function a() { return document.title; }\n`,
  },
  {
    name: "lms-core rejects localStorage",
    file: "src/lms-core/__guard_probe.ts",
    expect: "storage is the caller",
    code: `export function a() { return localStorage.getItem("k"); }\n`,
  },
  {
    name: "lms-core rejects fetch",
    file: "src/lms-core/__guard_probe.ts",
    expect: "stay pure",
    code: `export async function a() { return fetch("/x"); }\n`,
  },
  {
    name: "lms-core rejects process.env",
    file: "src/lms-core/__guard_probe.ts",
    expect: "configuration as arguments",
    code: `export function a() { return process.env.X; }\n`,
  },
  {
    name: "lms-core rejects JSX",
    file: "src/lms-core/__guard_probe.tsx",
    expect: "renderer leaked in",
    code: `export const a = () => <div />;\n`,
  },
  // The two false positives the old line-regex guard produced. Both must pass.
  {
    name: "lms-core allows a parameter named document",
    file: "src/lms-core/__guard_probe.ts",
    expect: null,
    code: `export function a(document: { id: string }) { return document.id; }\n`,
  },
  {
    name: "lms-core allows a comment naming window",
    file: "src/lms-core/__guard_probe.ts",
    expect: null,
    code: `// This module must never reach for window.localStorage.\nexport const a = 1;\n`,
  },

  // --- public route files compose, they do not draw -------------------------
  {
    name: "route file rejects a CSS import",
    file: "src/app/(platform)/__guard_probe/page.tsx",
    expect: "must not import CSS",
    code: `import "./probe.css";\nexport default function P() { return null; }\n`,
  },
  {
    name: "route file rejects PlatformContentStyles",
    file: "src/app/(platform)/__guard_probe/page.tsx",
    expect: "PlatformContentStyles directly",
    code: `import s from "@/components/platform/PlatformContentStyles";\nexport default function P() { return String(s); }\n`,
  },
  {
    name: "route file rejects a structural tag",
    file: "src/app/(platform)/__guard_probe/page.tsx",
    expect: "structural layout tags",
    code: `export default function P() { return <section>x</section>; }\n`,
  },
  {
    name: "route file allows a plain element",
    file: "src/app/(platform)/__guard_probe/page.tsx",
    expect: null,
    code: `export default function P() { return <div>x</div>; }\n`,
  },

  // --- the admin is grey ----------------------------------------------------
  {
    name: "admin rejects a colour utility",
    file: "src/app/(platform)/admin/__guard_probe.tsx",
    expect: "admin is grey",
    code: `export const a = <div className="bg-blue-500" />;\n`,
  },
  {
    name: "admin rejects a gradient",
    file: "src/app/(platform)/admin/__guard_probe.tsx",
    expect: "admin is grey",
    code: `export const a = <div className="bg-gradient-to-r" />;\n`,
  },
  {
    name: "admin rejects a colour inside a template literal",
    file: "src/app/(platform)/admin/__guard_probe.tsx",
    expect: "admin is grey",
    code: 'export const a = (on: boolean) => <div className={`p-2 ${on ? "text-red-600" : ""}`} />;\n',
  },
  {
    name: "admin allows a grey utility",
    file: "src/app/(platform)/admin/__guard_probe.tsx",
    expect: null,
    code: `export const a = <div className="px-3 py-2 text-sm" />;\n`,
  },

  // --- the layers -----------------------------------------------------------
  {
    name: "lib rejects an import from components",
    file: "src/lib/__guard_probe.ts",
    expect: "lib must not import",
    code: `import { PlatformStyles } from "@/components/platform/PlatformStyles";\nexport const a = PlatformStyles;\n`,
  },
  {
    name: "components reject an import from app",
    file: "src/components/__guard_probe.ts",
    expect: "components must not import",
    code: `import { metadata } from "@/app/layout";\nexport const a = metadata;\n`,
  },
];

/**
 * The two route files that are exempt from the structural-tag rule by path.
 * Asserted through the resolved config rather than by linting them: they are
 * real pages, and the point is that the exemption still lands on exactly them.
 */
const exemptions = [
  { file: "src/app/(platform)/funnel-entry/[product]/page.tsx", structuralRule: false },
  { file: "src/app/(platform)/lesson/pilot/page.tsx", structuralRule: false },
  { file: "src/app/(platform)/programs/[slug]/page.tsx", structuralRule: true },
];

const eslint = new ESLint({ cwd: root });
let failed = 0;

function write(rel, code) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, code);
  return abs;
}

function remove(abs) {
  fs.rmSync(abs, { force: true });
  const dir = path.dirname(abs);
  if (path.basename(dir).startsWith("__guard_probe") && fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
    fs.rmdirSync(dir);
  }
}

for (const testCase of cases) {
  const written = [write(testCase.file, testCase.code)];
  if (testCase.also) written.push(write(testCase.also.file, testCase.also.code));

  try {
    const [result] = await eslint.lintFiles([written[0]]);
    const errors = (result?.messages ?? []).filter((message) => message.severity === 2);
    const text = errors.map((message) => message.message).join(" | ");

    if (testCase.expect === null) {
      if (errors.length === 0) {
        console.log(`PASS ${testCase.name}`);
      } else {
        failed += 1;
        console.error(`FAIL ${testCase.name} — expected no error, got: ${text}`);
      }
    } else if (text.includes(testCase.expect)) {
      console.log(`PASS ${testCase.name}`);
    } else {
      failed += 1;
      console.error(`FAIL ${testCase.name} — expected "${testCase.expect}", got: ${text || "no error at all"}`);
    }
  } finally {
    for (const abs of written) remove(abs);
  }
}

for (const { file, structuralRule } of exemptions) {
  const config = await eslint.calculateConfigForFile(file);
  const applied = Boolean(config.rules?.["no-restricted-syntax"]);
  if (applied === structuralRule) {
    console.log(`PASS structural-tag rule is ${structuralRule ? "on" : "off"} for ${file}`);
  } else {
    failed += 1;
    console.error(
      `FAIL structural-tag rule should be ${structuralRule ? "on" : "off"} for ${file}, it is ${applied ? "on" : "off"}`,
    );
  }
}

if (failed > 0) {
  console.error(`\nguard:eslint FAILED — ${failed} rule(s) did not behave as specified.`);
  process.exit(1);
}
console.log(
  `\nguard:eslint OK — ${cases.length + exemptions.length} checks, every rule bites and no clean file is refused.`,
);
