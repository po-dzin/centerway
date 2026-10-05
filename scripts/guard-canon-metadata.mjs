import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_CANON_ROOT,
  SNAPSHOT_PATH,
  readCanonProjection,
  validateCanonProjection,
} from "./lib/canon-metadata.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const canonRoot = process.env.CENTERWAY_CANON_ROOT || DEFAULT_CANON_ROOT;
try {
  const snapshot = JSON.parse(fs.readFileSync(path.join(repoRoot, SNAPSHOT_PATH), "utf8"));
  const liveProjection = fs.existsSync(canonRoot) ? readCanonProjection(canonRoot) : undefined;
  const errors = validateCanonProjection(snapshot, { repoRoot, liveProjection });
  if (liveProjection)
    errors.push(...validateCanonProjection(liveProjection, { repoRoot }).map((error) => `live: ${error}`));
  if (errors.length) throw new Error([...new Set(errors)].join("\n"));
  console.log(
    `[guard:canon-metadata] PASS ${snapshot.notes.length} notes, ${snapshot.registry.length} rows; ${liveProjection ? "live canon and snapshot verified" : "snapshot-only / live canon not verified"}`,
  );
} catch (error) {
  console.error(`[guard:canon-metadata] FAIL\n${error.message}`);
  process.exitCode = 1;
}
