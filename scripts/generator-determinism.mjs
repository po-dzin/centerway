import crypto from "node:crypto";
import {
  loadGeneratorManifests,
  resolveScreenForRoute,
  stableStringify,
  validateGeneratorManifests,
} from "./lib/generator-manifests.mjs";

const SCENARIOS = [
  {
    id: "consult-default",
    routeKey: "consult",
    assignments: {},
  },
  {
    id: "consult-warm-route",
    routeKey: "consult",
    assignments: {
      consult_theme_v1: {
        experiment_key: "consult_theme_v1",
        variant_key: "warm_route",
        source: "override",
      },
    },
  },
  {
    id: "detox-default",
    routeKey: "detox",
    assignments: {},
  },
  {
    id: "herbs-default",
    routeKey: "herbs",
    assignments: {},
  },
  {
    id: "dosha-default",
    routeKey: "dosha-test",
    assignments: {},
  },
  {
    id: "dosha-routecopy",
    routeKey: "dosha-test",
    assignments: {
      dosha_ui_variant_v1: {
        experiment_key: "dosha_ui_variant_v1",
        variant_key: "routecopy",
        source: "override",
      },
    },
  },
  {
    id: "lesson-pilot",
    routeKey: "lesson-pilot",
    assignments: {},
  },
];

function toFingerprintPayload(resolved) {
  return {
    screen: {
      id: resolved.screen.id,
      version: resolved.screen.version,
      route_key: resolved.screen.route_key,
      mode: resolved.screen.mode,
      branch: resolved.screen.branch,
    },
    experiment: resolved.experimentResolution,
    blocks: resolved.blocks.map((block) => ({
      id: block.id,
      recipe_id: block.recipe.id,
      recipe_version: block.recipe.version,
      component_key: block.recipe.component_key,
      props: block.props,
    })),
    tokens: resolved.tokens,
  };
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function main() {
  const { manifests } = await loadGeneratorManifests();
  const validation = validateGeneratorManifests(manifests);

  for (const scenario of SCENARIOS) {
    const first = resolveScreenForRoute(validation, scenario.routeKey, scenario.assignments);
    const second = resolveScreenForRoute(validation, scenario.routeKey, scenario.assignments);

    const firstJson = stableStringify(toFingerprintPayload(first));
    const secondJson = stableStringify(toFingerprintPayload(second));

    if (firstJson !== secondJson) {
      console.error(`Determinism check failed: ${scenario.id}`);
      process.exit(1);
    }

    console.log(`deterministic:${scenario.id}:${sha256(firstJson)}`);
  }

  console.log("Generator determinism checks OK");
}

main().catch((error) => {
  console.error("Generator determinism checks failed");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
