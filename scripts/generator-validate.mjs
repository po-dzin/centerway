import {
  loadGeneratorManifests,
  summarizeValidation,
  validateGeneratorManifests,
} from "./lib/generator-manifests.mjs";

async function main() {
  const { manifests } = await loadGeneratorManifests();
  const validation = validateGeneratorManifests(manifests);
  const summary = summarizeValidation(validation);

  console.log("Generator manifests validation OK");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("Generator manifests validation failed");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
