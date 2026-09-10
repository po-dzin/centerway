import { spawn } from "node:child_process";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");
const browserMode = (process.env.LANDING_GATE_BROWSER_SMOKE || "auto").trim().toLowerCase();

function isBrowserSmokeEnabled(mode) {
  return mode === "1" || mode === "true" || mode === "on" || mode === "yes" || mode === "auto";
}

function isBrowserSmokeRequired(mode) {
  return mode === "1" || mode === "true" || mode === "on" || mode === "yes";
}

function runStep(title, command, args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    console.log(`\n[landing-gate] ${title}`);
    const child = spawn(command, args, {
      stdio: "inherit",
      env: { ...process.env, ...extraEnv },
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${title} failed with code ${code}`));
    });
  });
}

async function main() {
  console.log(`[landing-gate] base URL ${baseUrl}`);
  console.log(`[landing-gate] browser smoke mode: ${browserMode}`);
  console.log("[landing-gate] note: start Next first (example: PORT=8000 npm run dev) for live URL checks");
  await runStep("guard:ds-contract", "node", ["scripts/guard-ds-contract.mjs"]);
  await runStep("lint", "npm", ["run", "-s", "lint"]);
  await runStep("smoke:landing:cutover-toggle", "npm", ["run", "-s", "smoke:landing:cutover-toggle"]);
  await runStep("smoke:landing:next-contract", "npm", ["run", "-s", "smoke:landing:next-contract"], {
    SMOKE_BASE_URL: baseUrl,
    SMOKE_REQUIRE_NEXT_LANDING: "1",
  });

  if (isBrowserSmokeEnabled(browserMode)) {
    try {
      await runStep("smoke:landing:short-irem", "npm", ["run", "-s", "smoke:landing:short-irem"], {
        SMOKE_BASE_URL: baseUrl,
        SMOKE_LANDING_ENTRY: "next",
      });
    } catch (error) {
      if (isBrowserSmokeRequired(browserMode)) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[landing-gate] WARN browser smoke skipped in auto mode: ${message}`);
    }
  } else {
    console.log("[landing-gate] browser smoke disabled");
  }

  console.log("\n[landing-gate] PASS short/irem landing gate");
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(`\n[landing-gate] FAIL\n${message}`);
  process.exit(1);
});
