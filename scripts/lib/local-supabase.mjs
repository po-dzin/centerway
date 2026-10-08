import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export const LOCAL_CLI_VERSION = "2.119.0";
export const localRuntimeDir = path.resolve(".local");
export const localCli = path.join(localRuntimeDir, "bin", "supabase");
export const localProject = path.join(localRuntimeDir, "native-project");

export function localStackArgs() {
  const idFile = path.join(localRuntimeDir, "stack-id");
  if (!fs.existsSync(idFile)) return [];
  const id = fs.readFileSync(idFile, "utf8").trim();
  if (!/^[a-f0-9]{64}$/.test(id)) throw new Error("Invalid saved native stack identity.");
  return ["--stack-id", id];
}

export function nativeEnv() {
  return {
    ...process.env,
    SUPABASE_HOME: path.join(localRuntimeDir, "supabase"),
    SUPABASE_EXPERIMENTAL_STACK: "1",
  };
}

export function nativeStatus({ envOnly = false } = {}) {
  const args = ["stack", "status", "--workdir", localProject, ...localStackArgs(), "--output-format", "json"];
  if (envOnly) args.push("--env");
  return spawnSync(localCli, args, {
    encoding: "utf8",
    env: nativeEnv(),
  });
}

export function localConnectionEnv() {
  if (!fs.existsSync(localCli)) {
    // Keep existing Docker setups readable until the native runtime is prepared.
    return spawnSync("supabase", ["status", "-o", "env"], { encoding: "utf8" });
  }
  const status = nativeStatus({ envOnly: true });
  if (status.status !== 0) return status;
  const parsed = JSON.parse(status.stdout);
  const values = parsed.env ?? parsed;
  return {
    ...status,
    stdout: Object.entries(values)
      .filter(([, value]) => typeof value === "string")
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join("\n"),
  };
}
