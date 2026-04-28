import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const generatorRoot = path.join(root, "data", "generator");
const failures = [];

function readJson(relativePath) {
  return JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));
}

function fail(message) {
  failures.push(message);
}

const routeContracts = readJson("data/generator/route_family_contracts.json");
const screens = readJson("data/generator/screen_manifests.json");
const blocks = readJson("data/generator/block_manifests.json");
const semanticBlocks = readJson("data/generator/semantic_block_layer.json");

const contractById = new Map(routeContracts.contracts.map((item) => [item.id, item]));
const blockById = new Map(blocks.blocks.map((item) => [item.id, item]));
const semanticById = new Map(semanticBlocks.blocks.map((item) => [item.id, item]));

if (!existsSync(path.join(generatorRoot, "route_family_contracts.json"))) {
  fail("Missing route family contract layer: data/generator/route_family_contracts.json");
}

for (const screen of screens.manifests) {
  const contract = contractById.get(screen.route_family_contract_id);
  if (!contract) {
    fail(`${screen.id}: missing route family contract ${screen.route_family_contract_id}`);
    continue;
  }
  if (screen.route_family !== contract.route_family) {
    fail(`${screen.id}: route_family does not match contract`);
  }
  if (!contract.route_paths.includes(screen.route_path)) {
    fail(`${screen.id}: route_path ${screen.route_path} is not allowed for ${contract.id}`);
  }
  if (!contract.allowed_archetypes.includes(screen.archetype)) {
    fail(`${screen.id}: archetype ${screen.archetype} is not allowed for ${contract.id}`);
  }

  const semanticRoles = new Set();
  const blockTypes = [];
  for (const screenBlock of screen.blocks) {
    const block = blockById.get(screenBlock.block_manifest_id);
    if (!block) {
      fail(`${screen.id}: missing block manifest ${screenBlock.block_manifest_id}`);
      continue;
    }
    if (!contract.allowed_renderers.includes(block.renderer)) {
      fail(`${screen.id}: renderer ${block.renderer} is not allowed by ${contract.id}`);
    }
    semanticRoles.add(block.semantic_role);
    const semantic = semanticById.get(block.semantic_block_id);
    if (!semantic) {
      fail(`${screen.id}: block ${block.id} references missing semantic block ${block.semantic_block_id}`);
    } else {
      blockTypes.push(semantic.block_type);
    }
    for (const field of ["semantic_role", "semantic_family", "user_question", "route_boundary", "renderer"]) {
      if (!block[field]) {
        fail(`${block.id}: missing contract field ${field}`);
      }
    }
    if (!Array.isArray(block.required_fields) || block.required_fields.length === 0) {
      fail(`${block.id}: required_fields must be non-empty`);
    }
    if (!Array.isArray(block.allowed_actions) || block.allowed_actions.length === 0) {
      fail(`${block.id}: allowed_actions must be non-empty`);
    }
  }

  for (const role of contract.required_semantic_roles ?? []) {
    if (!semanticRoles.has(role)) {
      fail(`${screen.id}: missing required semantic role ${role}`);
    }
  }

  const order = contract.allowed_block_order ?? [];
  let previousIndex = -1;
  for (const blockType of blockTypes) {
    const index = order.indexOf(blockType);
    if (index === -1) {
      fail(`${screen.id}: block type ${blockType} is not listed in route-family order`);
      continue;
    }
    if (index < previousIndex) {
      fail(`${screen.id}: block type ${blockType} appears out of route-family order`);
    }
    previousIndex = Math.max(previousIndex, index);
  }
}

const herbsProgramPath = path.join(root, "src", "app", "programs", "herbs");
if (existsSync(herbsProgramPath)) {
  fail("/herbs invariant failed: src/app/programs/herbs must not exist");
}

const herbsScreens = screens.manifests.filter((screen) => screen.route_key === "herbs");
for (const screen of herbsScreens) {
  if (screen.route_path !== "/herbs") {
    fail(`/herbs invariant failed: ${screen.id} uses route_path ${screen.route_path}`);
  }
  if (screen.route_family !== "funnel surface") {
    fail(`/herbs invariant failed: ${screen.id} must remain a root funnel surface`);
  }
}

if (failures.length > 0) {
  console.error("[FAIL] Semantic architecture audit");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("[PASS] Semantic architecture audit");
