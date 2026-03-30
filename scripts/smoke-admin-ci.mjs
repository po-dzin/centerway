import { spawn } from "node:child_process";

const hasAdminBearer = Boolean(process.env.SMOKE_ADMIN_BEARER);
const hasUserBearer = Boolean(process.env.SMOKE_USER_BEARER);

const steps = [
  { name: "smoke:admin", cmd: "npm", args: ["run", "-s", "smoke:admin"], required: true },
  { name: "smoke:admin:authz-surface", cmd: "npm", args: ["run", "-s", "smoke:admin:authz-surface"], required: true },
  { name: "smoke:admin:authz-coverage", cmd: "npm", args: ["run", "-s", "smoke:admin:authz-coverage"], required: true },
  { name: "smoke:admin:payload-contracts", cmd: "npm", args: ["run", "-s", "smoke:admin:payload-contracts"], required: true },
  { name: "smoke:admin:write-guards", cmd: "npm", args: ["run", "-s", "smoke:admin:write-guards"], required: true },
  {
    name: "smoke:admin:auth",
    cmd: "npm",
    args: ["run", "-s", "smoke:admin:auth"],
    required: hasAdminBearer,
    skipReason: "SMOKE_ADMIN_BEARER is not set",
  },
  {
    name: "smoke:admin:funnel",
    cmd: "npm",
    args: ["run", "-s", "smoke:admin:funnel"],
    required: hasAdminBearer,
    skipReason: "SMOKE_ADMIN_BEARER is not set",
  },
];

function runStep(step) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(step.cmd, step.args, {
      stdio: "inherit",
      env: process.env,
      shell: false,
    });

    child.on("exit", (code, signal) => {
      const elapsedMs = Date.now() - startedAt;
      resolve({
        name: step.name,
        code: code ?? 1,
        signal: signal ?? null,
        elapsedMs,
      });
    });

    child.on("error", () => {
      const elapsedMs = Date.now() - startedAt;
      resolve({
        name: step.name,
        code: 1,
        signal: null,
        elapsedMs,
      });
    });
  });
}

async function main() {
  console.log("Admin smoke CI started");
  console.log(`SMOKE_ADMIN_BEARER: ${hasAdminBearer ? "set" : "missing"}`);
  console.log(`SMOKE_USER_BEARER: ${hasUserBearer ? "set" : "missing"}`);

  let failed = 0;
  let executed = 0;
  let skipped = 0;

  for (const step of steps) {
    if (!step.required) {
      skipped += 1;
      console.log(`SKIP ${step.name}: ${step.skipReason ?? "disabled"}`);
      continue;
    }

    executed += 1;
    console.log(`RUN  ${step.name}`);
    const result = await runStep(step);
    if (result.code === 0) {
      console.log(`PASS ${result.name} (${result.elapsedMs}ms)`);
    } else {
      failed += 1;
      console.log(`FAIL ${result.name} (exit=${result.code}, signal=${result.signal ?? "none"}, ${result.elapsedMs}ms)`);
    }
  }

  console.log(`Admin smoke CI summary: executed=${executed}, skipped=${skipped}, failed=${failed}`);
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
