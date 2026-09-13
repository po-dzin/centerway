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
   analytics — was hardcoded in the page for months while this guard reported
   PASS, because a string that never became a key is invisible to a check that
   starts from keys. This scan starts from the SOURCE instead. The admin's pages
   moved under `(protected)/` in the meantime; the prefix below still covers
   them. */
const ADMIN_SOURCE_DIRS = ["src/app/(platform)/admin", "src/components/admin"];

const CYRILLIC = /[\u0400-\u04FF]/;

const FORBIDDEN_UK = [/останн(ій|я)\s+шанс/i, /тільки\s+сьогодні/i, /терміново/i, /купи\s+зараз/i, /не\s+проґав/i];

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
    block || line ? match.replace(/[^\n]/g, " ") : match,
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
      const lineOf = (index) => source.slice(0, index).split("\n").length;

      /* WHOLE FILE, NOT LINE BY LINE. The first version of this scan matched
         `>text<` within a single line, and JSX puts long text on its own line
         between a tag that ends the line above and one that starts the line
         below — so every multi-line paragraph in the admin was invisible to
         the check written to find exactly those. Caught by opening the dosha
         tab and reading a sentence the gate had just called clean.
         `[^<>{}]` matches newlines already; the scan simply must not be
         chopped into lines before it runs. */
      for (const pattern of [/"[^"\n]*"|'[^'\n]*'|`[^`]*`/g, />[^<>{}]*</g]) {
        for (const match of source.matchAll(pattern)) {
          if (!CYRILLIC.test(match[0])) continue;
          const text = match[0].replace(/\s+/g, " ").trim().slice(0, 70);
          offenders.push(`${file}:${lineOf(match.index)} ${text}`);
        }
      }
    }
  }

  if (offenders.length === 0) {
    pass("admin surfaces carry no hardcoded display strings");
    return;
  }
  fail(
    `admin display strings written in source instead of src/lib/i18n/ (${offenders.length}):\n  ` +
      offenders.join("\n  "),
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

/* READ THE SOURCE, NOT THE BUILT MODULE. The dictionary moved to paired
   entries in `src/lib/i18n/*.ts` (2026-09-11), so this reads each area file's
   literal rather than one `translations` object. Evaluating the literal keeps
   the guard free of a TypeScript loader — it runs on a checkout with nothing
   built, which is the point of a guard. */
const I18N_DIR = "src/lib/i18n";

async function parseTranslations() {
  const files = readdirSync(I18N_DIR).filter((name) => name.endsWith(".ts"));
  if (files.length === 0) throw new Error(`No dictionary files found in ${I18N_DIR}`);

  const entries = {};
  for (const file of files) {
    const source = await readFile(path.join(I18N_DIR, file), "utf8");
    const start = source.indexOf("{");
    const end = source.lastIndexOf("} as const;");
    if (start === -1 || end === -1) throw new Error(`Unable to read the dictionary literal in ${file}`);
    const area = Function(`"use strict"; return (${source.slice(start, end + 1)});`)();
    for (const [key, pair] of Object.entries(area)) {
      if (key in entries) fail(`key "${key}" is declared in two area files`);
      entries[key] = pair;
    }
  }
  return entries;
}

/* Parity is structural now — a pair is one object — so what is left to check is
   that both halves are actually there and non-empty. A `{ uk }` with no `en` is
   a type error at the entry; a `{ uk, en: "" }` is not. */
function checkKeyParity(entries) {
  const broken = Object.entries(entries)
    .filter(([key]) => shouldCheckKey(key))
    .filter(([, pair]) => !isFilled(pair?.uk) || !isFilled(pair?.en))
    .map(([key]) => key);

  if (broken.length === 0) {
    pass("admin i18n key parity UK/EN is consistent");
    return;
  }
  fail(`admin keys missing or empty in one locale: ${broken.join(", ")}`);
}

function isFilled(value) {
  return typeof value === "string" && value.trim() !== "";
}

function localeView(entries, lang) {
  return Object.fromEntries(Object.entries(entries).map(([key, pair]) => [key, pair?.[lang]]));
}

function checkTone(entries) {
  const uk = localeView(entries, "uk");
  const en = localeView(entries, "en");

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
  console.log("Admin i18n/tone guard started");
  const entries = await parseTranslations();
  checkKeyParity(entries);
  checkTone(entries);
  await checkNoHardcodedStrings();
  if (process.exitCode) process.exit(process.exitCode);
  console.log("Admin i18n/tone guard passed");
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
