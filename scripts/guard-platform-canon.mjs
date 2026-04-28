import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const externalCanonRoot = "/Users/G/Documents/RAverse/ReOS/Projects/CenterWay";

const requiredExternalCanon = [
  "CenterWay.md",
  "Бренд-контракт.md",
  "Дизайн-токены.md",
  "Семиотический паспорт.md",
  "UI-UX канон.md",
  "Блоки и компоненты.md",
  "Архитектура.md",
  "Лендинги.md",
  "Registry.md",
];

const requiredLocalCanon = [
  "AGENTS.md",
  "docs/CANON.md",
  "docs/platform_agent_preflight.md",
];

const platformCssRoot = "src/components/platform";
const tokenSourceFiles = ["src/app/globals.css", "data/design-tokens/cw.tokens.json"];
const semanticRuntimeFiles = [
  "data/generator/route_family_contracts.json",
  "data/generator/screen_manifests.json",
  "data/generator/block_manifests.json",
  "data/generator/semantic_block_layer.json",
  "data/generator/component_recipes.json",
];
const hexAllowlist = new Set([
  // CSS keywords encoded as hex in browser/tooling output are not component tokens.
  "#000",
  "#000000",
  "#fff",
  "#ffffff",
]);

const failures = [];

function relativePath(absolutePath) {
  return path.relative(repoRoot, absolutePath).split(path.sep).join("/");
}

function lineAndColumn(source, index) {
  const before = source.slice(0, index);
  const lines = before.split("\n");
  return {
    line: lines.length,
    column: lines.at(-1).length + 1,
  };
}

function listFiles(root, predicate) {
  const absoluteRoot = path.join(repoRoot, root);
  if (!existsSync(absoluteRoot)) {
    return [];
  }

  const files = [];
  const stack = [absoluteRoot];

  while (stack.length) {
    const current = stack.pop();
    const entries = readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const absolute = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolute);
        continue;
      }

      if (entry.isFile() && predicate(absolute)) {
        files.push(absolute);
      }
    }
  }

  return files.sort((a, b) => relativePath(a).localeCompare(relativePath(b)));
}

function collectMatches(source, regex) {
  const matches = [];
  regex.lastIndex = 0;

  let match;
  while ((match = regex.exec(source)) !== null) {
    const token = match[1] ?? match[0];
    const tokenOffset = match.index + match[0].indexOf(token);
    matches.push({
      value: token,
      ...lineAndColumn(source, tokenOffset),
    });
  }

  return matches;
}

function addFailure(message, absolutePath, location) {
  if (!absolutePath) {
    failures.push(message);
    return;
  }

  const file = relativePath(absolutePath);
  if (!location) {
    failures.push(`${file}: ${message}`);
    return;
  }

  failures.push(`${file}:${location.line}:${location.column}: ${message}`);
}

function collectAllowedHexColors() {
  const allowed = new Set(hexAllowlist);

  for (const file of tokenSourceFiles) {
    const absolute = path.join(repoRoot, file);
    if (!existsSync(absolute)) {
      failures.push(`Missing token source file for platform hex allowlist: ${file}`);
      continue;
    }

    const source = readFileSync(absolute, "utf8");
    for (const match of collectMatches(source, /#[0-9a-fA-F]{3,8}\b/g)) {
      allowed.add(match.value.toLowerCase());
    }
  }

  return allowed;
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

for (const file of requiredExternalCanon) {
  const absolute = path.join(externalCanonRoot, file);
  if (!existsSync(absolute)) {
    failures.push(`Missing external canon file: ${absolute}`);
  }
}

for (const file of requiredLocalCanon) {
  const absolute = path.join(repoRoot, file);
  if (!existsSync(absolute)) {
    failures.push(`Missing local canon file: ${file}`);
  }
}

for (const file of semanticRuntimeFiles) {
  const absolute = path.join(repoRoot, file);
  if (!existsSync(absolute)) {
    failures.push(`Missing semantic runtime file: ${file}`);
  }
}

const agentsPath = path.join(repoRoot, "AGENTS.md");
if (existsSync(agentsPath)) {
  const agents = readFileSync(agentsPath, "utf8");
  const mandatorySection = /## Mandatory Canon Preflight For UI Work[\s\S]*?(?=\n## |\n# |$)/.exec(agents)?.[0] ?? "";

  if (!mandatorySection) {
    failures.push("AGENTS.md is missing section: ## Mandatory Canon Preflight For UI Work");
  }

  for (const phrase of [
    "Mandatory Canon Preflight",
    "semantic role",
    "user question",
    "token source",
    "content source",
    "route boundary",
    "Before editing, read AGENTS.md",
  ]) {
    if (!mandatorySection.includes(phrase)) {
      failures.push(`AGENTS.md mandatory section is missing required phrase: ${phrase}`);
    }
  }

  const requiredDelegation =
    "Before editing, read AGENTS.md and complete the CenterWay Mandatory Canon Preflight. Return the semantic role, user question, and token source for every page/block/component you changed.";
  if (!mandatorySection.includes(requiredDelegation)) {
    failures.push("AGENTS.md mandatory section is missing the exact sub-agent delegation instruction");
  }

  for (const file of requiredExternalCanon) {
    const externalPath = path.join(externalCanonRoot, file);
    if (!mandatorySection.includes(externalPath)) {
      failures.push(`AGENTS.md mandatory section is missing external canon path: ${externalPath}`);
    }
  }

  if (!mandatorySection.includes("docs/platform_agent_preflight.md")) {
    failures.push("AGENTS.md mandatory section must reference docs/platform_agent_preflight.md");
  }

  if (!agents.includes("docs/legacy/**")) {
    failures.push("AGENTS.md must explicitly mark docs/legacy/** as non-default reading");
  }
}

const preflightPath = path.join(repoRoot, "docs/platform_agent_preflight.md");
if (existsSync(preflightPath)) {
  const preflight = readFileSync(preflightPath, "utf8");
  for (const phrase of [
    "surface",
    "semantic_role",
    "user_question",
    "token_source",
    "content_source",
    "route_boundary",
  ]) {
    if (!preflight.includes(phrase)) {
      failures.push(`platform_agent_preflight.md is missing required field: ${phrase}`);
    }
  }

  for (const file of requiredExternalCanon) {
    if (!preflight.includes(file)) {
      failures.push(`platform_agent_preflight.md is missing canon source: ${file}`);
    }
  }

  for (const file of requiredLocalCanon.filter((file) => file !== "AGENTS.md" && file !== "docs/platform_agent_preflight.md")) {
    if (!preflight.includes(file)) {
      failures.push(`platform_agent_preflight.md is missing local implementation reference: ${file}`);
    }
  }

  if (!preflight.includes("docs/legacy/**")) {
    failures.push("platform_agent_preflight.md must explicitly mark docs/legacy/** as non-active preflight input");
  }
}

const platformCssFiles = listFiles(platformCssRoot, (file) => file.endsWith(".css"));
const allowedHexColors = collectAllowedHexColors();

if (!existsSync(path.join(repoRoot, platformCssRoot))) {
  failures.push(`Missing platform CSS root: ${platformCssRoot}`);
} else if (!platformCssFiles.length) {
  failures.push(`No platform CSS files found under ${platformCssRoot}`);
}

for (const absolute of platformCssFiles) {
  const source = readFileSync(absolute, "utf8");
  const localTokenDefinitions = collectMatches(source, /(--cw-[A-Za-z0-9_-]+)\s*:/g);

  for (const match of localTokenDefinitions) {
    addFailure(
      `Local CenterWay token definition is forbidden in platform component CSS: ${match.value}. Move it to the global/data token source or use an existing token.`,
      absolute,
      match,
    );
  }

  const rawHexColors = collectMatches(source, /#[0-9a-fA-F]{3,8}\b/g);
  for (const match of rawHexColors) {
    const value = match.value.toLowerCase();
    if (!allowedHexColors.has(value)) {
      addFailure(
        `Raw hex color is not in the platform allowlist: ${match.value}. Use a DS token or add the color to the canonical token source first.`,
        absolute,
        match,
      );
    }
  }
}

if (semanticRuntimeFiles.every((file) => existsSync(path.join(repoRoot, file)))) {
  const routeContracts = readJson("data/generator/route_family_contracts.json");
  const screens = readJson("data/generator/screen_manifests.json");
  const blocks = readJson("data/generator/block_manifests.json");
  const semanticBlocks = readJson("data/generator/semantic_block_layer.json");
  const recipes = readJson("data/generator/component_recipes.json");
  const contractById = new Map(routeContracts.contracts.map((item) => [item.id, item]));
  const blockById = new Map(blocks.blocks.map((item) => [item.id, item]));
  const semanticById = new Map(semanticBlocks.blocks.map((item) => [item.id, item]));
  const recipeComponentKeys = new Set(recipes.recipes.map((item) => item.component_key));

  for (const screen of screens.manifests) {
    const contract = contractById.get(screen.route_family_contract_id);
    if (!contract) {
      failures.push(`${screen.id}: missing route family contract ${screen.route_family_contract_id}`);
      continue;
    }
    if (screen.route_family !== contract.route_family) {
      failures.push(`${screen.id}: route family must match ${contract.id}`);
    }
    if (!contract.route_paths.includes(screen.route_path)) {
      failures.push(`${screen.id}: route path ${screen.route_path} is not allowed by ${contract.id}`);
    }
    if (!contract.allowed_archetypes.includes(screen.archetype)) {
      failures.push(`${screen.id}: archetype ${screen.archetype} is not allowed by ${contract.id}`);
    }

    const semanticRoles = new Set();
    for (const screenBlock of screen.blocks) {
      const block = blockById.get(screenBlock.block_manifest_id);
      if (!block) {
        failures.push(`${screen.id}: missing block manifest ${screenBlock.block_manifest_id}`);
        continue;
      }
      if (!block.semantic_role || !block.semantic_family || !block.user_question || !block.route_boundary || !block.renderer) {
        failures.push(`${block.id}: block contract is missing semantic role/family/question/boundary/renderer`);
      }
      if (!Array.isArray(block.required_fields) || block.required_fields.length === 0) {
        failures.push(`${block.id}: block contract must list required_fields`);
      }
      if (!Array.isArray(block.allowed_actions) || block.allowed_actions.length === 0) {
        failures.push(`${block.id}: block contract must list allowed_actions`);
      }
      if (!contract.allowed_renderers.includes(block.renderer)) {
        failures.push(`${screen.id}: renderer ${block.renderer} is not allowed by ${contract.id}`);
      }
      if (!recipeComponentKeys.has(block.renderer)) {
        failures.push(`${block.id}: renderer ${block.renderer} has no component recipe`);
      }
      if (!semanticById.has(block.semantic_block_id)) {
        failures.push(`${block.id}: missing semantic block ${block.semantic_block_id}`);
      }
      semanticRoles.add(block.semantic_role);
    }

    for (const role of contract.required_semantic_roles ?? []) {
      if (!semanticRoles.has(role)) {
        failures.push(`${screen.id}: missing required semantic role ${role}`);
      }
    }
  }

  const herbsProgramPath = path.join(repoRoot, "src/app/programs/herbs");
  if (existsSync(herbsProgramPath)) {
    failures.push("Route invariant failed: /herbs must not be duplicated as /programs/herbs");
  }
}

if (failures.length) {
  console.error("[FAIL] Platform canon guard");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("[PASS] Platform canon guard");
