/** Native local Supabase. No Docker engine; no production credentials. */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  LOCAL_CLI_VERSION,
  localCli,
  localProject,
  localRuntimeDir,
  nativeEnv,
  nativeStatus,
  localStackArgs,
} from "./lib/local-supabase.mjs";

async function prepareCli() {
  if (fs.existsSync(localCli)) return;
  if (process.platform !== "darwin" || process.arch !== "arm64") {
    throw new Error("This native launcher currently supports Apple Silicon macOS only.");
  }
  const asset = `supabase_${LOCAL_CLI_VERSION}_darwin_arm64.tar.gz`;
  const base = `https://github.com/supabase/cli/releases/download/v${LOCAL_CLI_VERSION}`;
  const download = async (name) => {
    const response = await fetch(`${base}/${name}`);
    if (!response.ok) throw new Error(`Official CLI download failed: HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  };
  const [archive, checksums] = await Promise.all([download(asset), download("checksums.txt")]);
  const checksum = checksums
    .toString()
    .split("\n")
    .find((line) => line.trim().endsWith(` ${asset}`))
    ?.split(/\s+/)[0];
  if (!checksum || createHash("sha256").update(archive).digest("hex") !== checksum) {
    throw new Error("Official Supabase CLI archive failed its checksum; refusing to execute.");
  }
  const binDir = path.dirname(localCli);
  fs.mkdirSync(binDir, { recursive: true });
  const archivePath = path.join(binDir, asset);
  fs.writeFileSync(archivePath, archive);
  const unpack = spawnSync("tar", ["-xzf", archivePath, "-C", binDir, "supabase"], { stdio: "inherit" });
  if (unpack.status !== 0) throw new Error("Could not unpack the verified Supabase CLI.");
  fs.rmSync(archivePath);
}

function setSectionValue(config, section, key, value) {
  const heading = `[${section}]`;
  const start = config.indexOf(`${heading}\n`);
  if (start < 0) throw new Error(`Missing ${heading} in Supabase config.`);
  const next = config.indexOf("\n[", start + heading.length);
  const end = next < 0 ? config.length : next;
  const body = config.slice(start, end);
  const updated = body.replace(new RegExp(`^${key}\\s*=.*$`, "m"), `${key} = ${value}`);
  if (updated === body && !body.includes(`${key} = ${value}`)) throw new Error(`Missing ${section}.${key}`);
  return config.slice(0, start) + updated + config.slice(end);
}

function prepareConfig() {
  let config = fs.readFileSync("supabase/config.toml", "utf8");
  // The checked-in snapshot loader owns public schema/content and migration rehearsal.
  // Starting the services must not also replay every production migration on an empty DB.
  config = setSectionValue(config, "db.migrations", "enabled", "false");
  config = setSectionValue(config, "db.seed", "enabled", "false");
  config = setSectionValue(config, "storage.vector", "enabled", "false");
  config = setSectionValue(config, "auth", "site_url", '"http://localhost:8000"');
  config = setSectionValue(config, "auth", "additional_redirect_urls", '["http://localhost:8000/**"]');
  fs.mkdirSync(path.join(localProject, "supabase"), { recursive: true });
  fs.writeFileSync(path.join(localProject, "supabase", "config.toml"), config);
}

const command = process.argv[2];
if (!["up", "down", "status", "prepare"].includes(command)) {
  console.error("Usage: node scripts/supabase-local.mjs up|down|status|prepare");
  process.exit(1);
}

try {
  if (command === "up" || command === "prepare") {
    await prepareCli();
    prepareConfig();
  } else if (!fs.existsSync(localCli)) {
    throw new Error("Native runtime has not been prepared. Run npm run db:local:up.");
  }
  if (command === "prepare") {
    console.log(`Verified Supabase CLI ${LOCAL_CLI_VERSION}; native config prepared in ${localRuntimeDir}.`);
  } else if (command === "status") {
    const result = nativeStatus();
    if (result.status !== 0) throw new Error("Native stack is down. Run npm run db:local:up.");
    const status = JSON.parse(result.stdout);
    // Do not print exported keys; status is for runtime and service state only.
    console.log(
      JSON.stringify({ runtime: status.runtime, services: status.services, endpoints: status.endpoints }, null, 2),
    );
  } else {
    const args =
      command === "up"
        ? [
            "stack",
            "start",
            "--runtime",
            "native",
            "--preparation",
            "on-demand",
            "--exclude",
            "realtime,functions,studio,mail,analytics,pooler",
          ]
        : ["stack", "stop"];
    const logDir = path.join(localRuntimeDir, "logs");
    fs.mkdirSync(logDir, { recursive: true });
    const output = fs.openSync(path.join(logDir, `${command}.log`), "w", 0o600);
    console.log(`${command === "up" ? "Starting" : "Stopping"} native Supabase; log: .local/logs/${command}.log`);
    const result = spawnSync(
      localCli,
      [...args, "--workdir", localProject, ...localStackArgs(), "--output-format", "json"],
      {
        env: nativeEnv(),
        stdio: ["ignore", output, output],
      },
    );
    fs.closeSync(output);
    if (result.status !== 0) throw new Error(`Native ${command} failed. Inspect .local/logs/${command}.log.`);
    if (command === "up") {
      const status = nativeStatus();
      if (status.status !== 0) throw new Error("Native stack started but could not be inspected.");
      const id = JSON.parse(status.stdout).identity?.id;
      if (!/^[a-f0-9]{64}$/.test(id)) throw new Error("Native stack did not report a valid identity.");
      // One saved stack per checkout: branch changes must not spawn a second database on the same ports.
      fs.writeFileSync(path.join(localRuntimeDir, "stack-id"), `${id}\n`);
    }
    console.log(`Native Supabase ${command === "up" ? "started without Docker" : "stopped; data retained"}.`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
