import { spawn } from "node:child_process";

const hasAdminBearer = Boolean(process.env.SMOKE_ADMIN_BEARER);
const hasUserBearer = Boolean(process.env.SMOKE_USER_BEARER);
const hasUiBaseUrl = Boolean(process.env.SMOKE_UI_BASE_URL || process.env.SMOKE_BASE_URL);

const steps = [
  { name: "smoke:admin:governance", cmd: "npm", args: ["run", "-s", "smoke:admin:governance"], required: true },
  { name: "smoke:admin:i18n-tone", cmd: "npm", args: ["run", "-s", "smoke:admin:i18n-tone"], required: true },
  { name: "smoke:admin:a11y-contract", cmd: "npm", args: ["run", "-s", "smoke:admin:a11y-contract"], required: true },
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
  {
    name: "smoke:admin:landing-offers",
    cmd: "npm",
    args: ["run", "-s", "smoke:admin:landing-offers"],
    required: hasAdminBearer,
    skipReason: "SMOKE_ADMIN_BEARER is not set",
  },
  {
    name: "smoke:admin:ui",
    cmd: "npm",
    args: ["run", "-s", "smoke:admin:ui"],
    required: hasUiBaseUrl,
    skipReason: "SMOKE_UI_BASE_URL/SMOKE_BASE_URL is not set",
  },
  {
    name: "smoke:admin:responsive",
    cmd: "npm",
    args: ["run", "-s", "smoke:admin:responsive"],
    required: hasUiBaseUrl,
    skipReason: "SMOKE_UI_BASE_URL/SMOKE_BASE_URL is not set",
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

async function isServerRunning() {
  try {
    await fetch("http://localhost:8000/");
    return true;
  } catch { return false; }
}

async function main() {
  console.log("Admin smoke CI started");
  const serverUp = await isServerRunning();
  if (!serverUp) console.warn("WARNING: Server at localhost:8000 is unreachable. Network tests may fail.");
  console.log(`SMOKE_ADMIN_BEARER: ${hasAdminBearer ? "set" : "missing"}`);
  if (!serverUp) {
    const networkSteps = ["smoke:admin", "smoke:admin:authz-surface", "smoke:admin:authz-coverage", "smoke:admin:payload-contracts", "smoke:admin:write-guards"];
    for (const step of steps) {
      if (networkSteps.includes(step.name)) {
        step.required = false;
        step.skipReason = "Server unreachable";
      }
    }
  }
  console.log(`SMOKE_USER_BEARER: ${hasUserBearer ? "set" : "missing"}`);
  console.log(`SMOKE_UI_BASE_URL/SMOKE_BASE_URL: ${hasUiBaseUrl ? "set" : "missing"}`);

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
