import { readFile } from "node:fs/promises";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";

/* Every prefix an admin string can carry. A key whose prefix is missing here is
   not checked for UK/EN parity at all — `leads_` was, for a day, exactly that:
   thirteen new keys nobody was comparing. If you add a family of admin strings,
   add its prefix. */
const ADMIN_KEY_PREFIXES = [
  "sidebar_",
  "nav_",
  "login_",
  "admin_",
  "menu_",
  "loading",
  "common_",
  "audit_",
  "analytics_",
  "system_",
  "orders_",
  "jobs_",
  "customers_",
  "leads_",
  "catalog_",
  "access_",
];

/* WHERE ADMIN STRINGS ARE WRITTEN. The parity check above reads the dictionary,
   so it can only ever see strings that reached it. An entire tab — the dosha
   analytics — was hardcoded in the page for months while this smoke reported
   PASS, because a string that never became a key is invisible to a check that
   starts from keys. This scan starts from the SOURCE instead. */
const ADMIN_SOURCE_DIRS = ["src/app/(platform)/admin", "src/components/admin"];

const CYRILLIC = /[\u0400-\u04FF]/;

const FORBIDDEN_UK = [
  /останн(ій|я)\s+шанс/i,
  /тільки\s+сьогодні/i,
  /терміново/i,
  /купи\s+зараз/i,
  /не\s+проґав/i,
];

const FORBIDDEN_EN = [
  /last\s+chance/i,
  /today\s+only/i,
  /act\s+now/i,
  /buy\s+now/i,
  /don't\s+miss/i,
  /limited\s+time/i,
];

/* Consumes strings BEFORE comment markers, so a `//` inside a string literal is
   not mistaken for a comment and — more importantly here — the many Cyrillic
   prose comments in this codebase are removed without taking real strings with
   them. Comments are blanked rather than deleted so line numbers survive. */
const JS_TOKENS = /("(?:\\.|[^"\\])*")|('(?:\\.|[^'\\])*')|(`(?:\\.|[^`\\])*`)|(\/\*[\s\S]*?\*\/)|(\/\/[^\n]*)/g;

function stripComments(source) {
  return source.replace(JS_TOKENS, (match, _dq, _sq, _tq, block, line) =>
    block || line ? match.replace(/[^\n]/g, " ") : match
  );
}

function collectSourceFiles(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) collectSourceFiles(full, out);
    else if (full.endsWith(".tsx") || full.endsWith(".ts")) out.push(full);
  }
  return out;
}

async function checkNoHardcodedStrings() {
  const offenders = [];

  for (const dir of ADMIN_SOURCE_DIRS) {
    for (const file of collectSourceFiles(dir)) {
      if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) continue;
      const source = stripComments(await readFile(file, "utf8"));
      source.split("\n").forEach((line, index) => {
        const literals = line.match(/"[^"\n]*"|'[^'\n]*'|`[^`\n]*`/g) ?? [];
        const jsxText = line.match(/>[^<>{}]*</g) ?? [];
        for (const candidate of [...literals, ...jsxText]) {
          if (CYRILLIC.test(candidate)) {
            offenders.push(`${file}:${index + 1} ${candidate.trim().slice(0, 60)}`);
          }
        }
      });
    }
  }

  if (offenders.length === 0) {
    pass("admin surfaces carry no hardcoded display strings");
    return;
  }
  fail(
    `admin display strings written in source instead of src/lib/i18n.ts (${offenders.length}):\n  ` +
      offenders.join("\n  ")
  );
}

function fail(message) {
  console.log(`FAIL ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`PASS ${message}`);
}

function shouldCheckKey(key) {
  return ADMIN_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function parseTranslations(fileContent) {
  const startMarker = "export const translations =";
  const endMarker = "} as const;";
  const start = fileContent.indexOf(startMarker);
  const end = fileContent.lastIndexOf(endMarker);
  if (start === -1 || end === -1) {
    throw new Error("Unable to find translations object in src/lib/i18n.ts");
  }
  const objectSource = fileContent
    .slice(start + startMarker.length, end + 1)
    .trim();
  return Function(`"use strict"; return (${objectSource});`)();
}

function checkKeyParity(translations) {
  const uk = translations.uk ?? {};
  const en = translations.en ?? {};
  const ukKeys = Object.keys(uk).filter(shouldCheckKey);
  const enKeys = Object.keys(en).filter(shouldCheckKey);

  const ukMissing = ukKeys.filter((key) => !(key in en));
  const enMissing = enKeys.filter((key) => !(key in uk));

  if (ukMissing.length === 0 && enMissing.length === 0) {
    pass("admin i18n key parity UK/EN is consistent");
    return;
  }
  if (ukMissing.length > 0) fail(`admin keys missing in EN: ${ukMissing.join(", ")}`);
  if (enMissing.length > 0) fail(`admin keys missing in UK: ${enMissing.join(", ")}`);
}

function checkTone(translations) {
  const uk = translations.uk ?? {};
  const en = translations.en ?? {};

  for (const [key, value] of Object.entries(uk)) {
    if (!shouldCheckKey(key) || typeof value !== "string") continue;
    for (const pattern of FORBIDDEN_UK) {
      if (pattern.test(value)) {
        fail(`forbidden UK pressure phrase found in key "${key}": "${value}"`);
      }
    }
  }

  for (const [key, value] of Object.entries(en)) {
    if (!shouldCheckKey(key) || typeof value !== "string") continue;
    for (const pattern of FORBIDDEN_EN) {
      if (pattern.test(value)) {
        fail(`forbidden EN pressure phrase found in key "${key}": "${value}"`);
      }
    }
  }

  if (!process.exitCode) pass("admin i18n tone guard passed");
}

async function main() {
  console.log("Admin i18n/tone smoke started");
  const source = await readFile("src/lib/i18n.ts", "utf8");
  const translations = parseTranslations(source);
  checkKeyParity(translations);
  checkTone(translations);
  await checkNoHardcodedStrings();
  if (process.exitCode) process.exit(process.exitCode);
  console.log("Admin i18n/tone smoke passed");
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
