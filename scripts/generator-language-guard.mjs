import fs from "node:fs/promises";
import path from "node:path";

const FILES = [
  "src/components/landing/revork/FunnelSections.tsx",
  "src/components/generator/DepthLabToggle.tsx",
  "src/components/dosha-test/DoshaTestClient.tsx",
  "src/components/lesson/PilotLessonRecipes.tsx",
  "data/generator/funnel_content.json",
  "data/generator/screen_manifests.json",
  "data/generator/block_manifests.json",
  "data/generator/semantic_block_layer.json",
];

const LATIN_WORD_RE = /[A-Za-z][A-Za-z0-9-]*/g;
const CYRILLIC_RE = /[\u0400-\u04FF]/;
const LATIN_RE = /[A-Za-z]/;
const WHITELIST = new Set([
  "CenterWay",
  "CENTERWAY",
]);

function extractStringLiterals(source) {
  const literals = [];
  const re = /(["'`])((?:\\.|(?!\1)[\s\S])*?)\1/gm;
  let match;
  while ((match = re.exec(source)) !== null) {
    literals.push({ text: match[2], index: match.index });
  }
  return literals;
}

function detectMixedLanguage(text) {
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
    const literals = rel.endsWith(".json")
      ? collectJsonStringLiterals(source)
      : extractStringLiterals(source);

    for (const literal of literals) {
      const badWords = detectMixedLanguage(literal.text);
      if (badWords.length === 0) continue;
      const line = source.slice(0, literal.index).split("\n").length;
      problems.push({ rel, line, badWords: Array.from(new Set(badWords)).join(", "), text: literal.text.slice(0, 120) });
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
