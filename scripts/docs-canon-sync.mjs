import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_CANON_ROOT,
  collectRepoFiles,
  SNAPSHOT_PATH,
  readCanonProjection,
  serializeProjection,
  validateCanonProjection,
} from "./lib/canon-metadata.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const canonRoot = process.env.CENTERWAY_CANON_ROOT || DEFAULT_CANON_ROOT;
try {
  if (!fs.existsSync(canonRoot)) throw new Error(`live canon unavailable: ${canonRoot}; sync requires live source`);
  const projection = readCanonProjection(canonRoot);
  // The only absent artifact allowed during bootstrap is the file this command will write.
  const repoFiles = [...collectRepoFiles(repoRoot), SNAPSHOT_PATH];
  const errors = validateCanonProjection(projection, { repoRoot, repoFiles });
  if (errors.length) throw new Error(errors.join("\n"));
  const destination = path.join(repoRoot, SNAPSHOT_PATH);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, serializeProjection(projection));
  console.log(
    `[docs:canon:sync] wrote ${SNAPSHOT_PATH}: ${projection.notes.length} notes, ${projection.registry.length} rows`,
  );
} catch (error) {
  console.error(`[docs:canon:sync] FAIL\n${error.message}`);
  process.exitCode = 1;
}
