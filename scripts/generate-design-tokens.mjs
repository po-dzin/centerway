import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const TOKENS_PATH = path.join(repoRoot, "data", "design-tokens", "cw.tokens.json");
const GLOBALS_CSS_PATH = path.join(repoRoot, "src", "app", "globals.css");

const LIGHT_START = "/* DS_ALIAS_LIGHT_START */";
const LIGHT_END = "/* DS_ALIAS_LIGHT_END */";
const DARK_START = "/* DS_ALIAS_DARK_START */";
const DARK_END = "/* DS_ALIAS_DARK_END */";

function toDecls(map, indent = "  ") {
  return Object.entries(map)
    .map(([name, value]) => `${indent}${name}: ${value};`)
    .join("\n");
}

function replaceBetween(source, startMarker, endMarker, nextBody) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`Missing markers: ${startMarker} ... ${endMarker}`);
  }

  const before = source.slice(0, start);
  const after = source.slice(end + endMarker.length);
  return `${before}${startMarker}\n${nextBody}\n    ${endMarker}${after}`;
}

async function main() {
  const rawTokens = await readFile(TOKENS_PATH, "utf8");
  const tokens = JSON.parse(rawTokens);

  const globals = await readFile(GLOBALS_CSS_PATH, "utf8");
  const lightDecls = toDecls(tokens.appAlias.light, "    ");
  const darkDecls = toDecls(tokens.appAlias.dark, "    ");

  let nextGlobals = replaceBetween(globals, LIGHT_START, LIGHT_END, lightDecls);
  nextGlobals = replaceBetween(nextGlobals, DARK_START, DARK_END, darkDecls);

  await writeFile(GLOBALS_CSS_PATH, nextGlobals, "utf8");
}

await main();
