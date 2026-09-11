/**
 * One language per string: a user-facing line is Ukrainian or it is English,
 * never both. Checks the generator's content manifests and the one screen whose
 * copy still lives in a component.
 *
 * WHY A PARSER AND NOT A REGEX. This guard used to find its strings with
 * `/(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/gm` over the raw file, which cannot know a
 * quote in code from a quote in prose. One apostrophe inside a Ukrainian
 * sentence \u2014 and there are many \u2014 opened a "string" that ran on through the JSX
 * until the next apostrophe, swallowing tag names, class names and props. It
 * then reported `className`, `div`, `href` and eighty more as untranslated
 * words in that sentence. The guard had been red for as long as that file has
 * had an apostrophe, and it was reading markup as copy the whole time.
 *
 * TypeScript's own scanner knows which characters are a string. It costs a
 * compiler import and removes the entire class of false positive.
 */

import fs from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const FILES = [
  "src/components/dosha-test/DoshaTestClient.tsx",
  "data/generator/funnel_content.json",
  "data/generator/screen_manifests.json",
  "data/generator/block_manifests.json",
  "data/generator/semantic_block_layer.json",
];

const LATIN_WORD_RE = /[A-Za-z][A-Za-z0-9-]*/g;
const CYRILLIC_RE = /[\u0400-\u04FF]/;
const LATIN_RE = /[A-Za-z]/;
/**
 * Proper nouns keep their spelling in every language, so they are not evidence
 * of an untranslated line. Only names belong here — a common word added to this
 * set is the guard being switched off one word at a time.
 */
const WHITELIST = new Set(["CenterWay", "CENTERWAY", "Telegram", "TELEGRAM"]);

/**
 * Every literal a reader could end up seeing: string and template literals, and
 * the text between JSX tags. Identifiers, imports, comments and JSX attribute
 * NAMES are not copy and never reach this list.
 */
function extractStringLiterals(source, rel) {
  const file = ts.createSourceFile(rel, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const literals = [];

  const take = (node, text) => literals.push({ text, index: node.getStart(file) });

  (function walk(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      // An import path is a string, but nobody reads it.
      const parent = node.parent;
      if (!parent || (!ts.isImportDeclaration(parent) && !ts.isExportDeclaration(parent))) take(node, node.text);
    } else if (ts.isTemplateExpression(node)) {
      // Each literal chunk on its own: the `${...}` holes are code, and a word
      // split across a hole was never one word.
      take(node.head, node.head.text);
      for (const span of node.templateSpans) take(span.literal, span.literal.text);
    } else if (ts.isJsxText(node)) {
      const text = node.text.trim();
      if (text) take(node, text);
    }
    ts.forEachChild(node, walk);
  })(file);

  return literals;
}

function detectMixedLanguage(text) {
  text = text.replace(/\$\{[^}]+\}/g, "");
  if (!CYRILLIC_RE.test(text) || !LATIN_RE.test(text)) return [];
  const words = text.match(LATIN_WORD_RE) ?? [];
  return words.filter((word) => !WHITELIST.has(word));
}

async function main() {
  const root = process.cwd();
  const problems = [];

  for (const rel of FILES) {
    const full = path.join(root, rel);
    const source = await fs.readFile(full, "utf8");
    const literals = rel.endsWith(".json") ? collectJsonStringLiterals(source) : extractStringLiterals(source, rel);

    for (const literal of literals) {
      const badWords = detectMixedLanguage(literal.text);
      if (badWords.length === 0) continue;
      const line = source.slice(0, literal.index).split("\n").length;
      problems.push({
        rel,
        line,
        badWords: Array.from(new Set(badWords)).join(", "),
        text: literal.text.slice(0, 120),
      });
    }
  }

  if (problems.length > 0) {
    for (const item of problems) {
      console.error(`mixed_language_detected:${item.rel}:${item.line}:${item.badWords} :: ${item.text}`);
    }
    process.exit(1);
  }

  console.log("generator language guard passed");
}

function collectJsonStringLiterals(source) {
  const parsed = JSON.parse(source);
  const out = [];
  const hitCounter = new Map();

  function walk(value) {
    if (typeof value === "string") {
      const quoted = JSON.stringify(value);
      const key = `${value}::${quoted}`;
      const from = hitCounter.get(key) ?? 0;
      const index = source.indexOf(quoted, from);
      if (index >= 0) {
        out.push({ text: value, index });
        hitCounter.set(key, index + quoted.length);
      } else {
        out.push({ text: value, index: 0 });
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (value && typeof value === "object") {
      Object.values(value).forEach(walk);
    }
  }

  walk(parsed);
  return out;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
