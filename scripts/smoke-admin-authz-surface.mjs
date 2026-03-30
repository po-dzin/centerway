import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const matrixPath = path.join(repoRoot, "data", "admin-authz-matrix.json");
const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");
const timeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || "10000", 10);

function loadMatrix() {
  const raw = fs.readFileSync(matrixPath, "utf8");
  const matrix = JSON.parse(raw);
  if (!Array.isArray(matrix)) {
    throw new Error(`Invalid authz matrix: expected array in ${path.relative(repoRoot, matrixPath)}`);
  }
  return matrix;
}

const matrix = loadMatrix();

function formatLabel(method, pathValue) {
  return `${method.padEnd(5, " ")} ${pathValue}`;
}

async function fetchWithTimeout(pathValue, options) {
  const url = `${baseUrl}${pathValue}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("Request timed out")), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal, redirect: "manual" });
  } finally {
    clearTimeout(timeout);
  }
}

async function checkCase(testCase) {
  const headers = { Accept: "application/json, text/plain, */*" };
  if (testCase.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const response = await fetchWithTimeout(testCase.path, {
      method: testCase.method,
      headers,
      body: testCase.body !== undefined ? JSON.stringify(testCase.body) : undefined,
    });

    const ok = response.status === 401 || response.status === 403;
    console.log(`${ok ? "PASS" : "FAIL"} ${formatLabel(testCase.method, testCase.path)} -> ${response.status}`);

    if (!ok) {
      const bodyPreview = (await response.text().catch(() => "")).trim().slice(0, 300);
      console.log(`  expected 401/403 without token, got ${response.status}`);
      if (bodyPreview) {
        console.log(`  body: ${bodyPreview}`);
      }
      return false;
    }

    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`FAIL ${formatLabel(testCase.method, testCase.path)} -> request error: ${message}`);
    return false;
  }
}

async function main() {
  console.log(`Admin authz surface smoke base URL: ${baseUrl}`);
  console.log(`Route/method matrix cases: ${matrix.length}`);

  const results = await Promise.all(matrix.map((testCase) => checkCase(testCase)));
  const failed = results.filter((result) => !result).length;

  if (failed > 0) {
    console.log(`Admin authz surface smoke failed: failed=${failed}, passed=${matrix.length - failed}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Admin authz surface smoke passed: passed=${matrix.length}, failed=0`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
