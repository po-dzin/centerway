import fs from "node:fs";
import path from "node:path";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");
const timeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || "10000", 10);
const userBearer = process.env.SMOKE_USER_BEARER || "";

const matrixPath = path.join(process.cwd(), "data", "admin-authz-matrix.json");

function loadMutateMatrix() {
  if (!fs.existsSync(matrixPath)) {
    throw new Error(`Admin authz matrix not found: ${matrixPath}`);
  }

  const parsed = JSON.parse(fs.readFileSync(matrixPath, "utf8"));
  if (!Array.isArray(parsed)) {
    throw new Error(`Admin authz matrix must be an array: ${matrixPath}`);
  }

  return parsed.filter((entry) => entry && entry.kind === "mutate");
}

const bodyFallbacks = new Map([
  ["PATCH /api/admin/orders", { order_ref: "smoke-order", status: "paid" }],
  ["PATCH /api/admin/customers/smoke", { display_name: "Smoke" }],
  ["PATCH /api/admin/analytics/marketing", { spend: 0 }],
]);

function normalizeCase(entry) {
  return {
    method: String(entry.method || "").toUpperCase(),
    path: String(entry.path || ""),
    body: entry.body !== undefined ? entry.body : bodyFallbacks.get(`${String(entry.method || "").toUpperCase()} ${String(entry.path || "")}`),
  };
}

const matrix = loadMutateMatrix().map(normalizeCase);

function formatLabel(method, path) {
  return `${method.padEnd(5, " ")} ${path}`;
}

async function fetchWithTimeout(path, options) {
  const url = `${baseUrl}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("Request timed out")), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal, redirect: "manual" });
  } finally {
    clearTimeout(timeout);
  }
}

function buildHeaders(includeBearer) {
  const headers = { Accept: "application/json, text/plain, */*" };
  if (includeBearer) {
    headers.Authorization = `Bearer ${userBearer}`;
  }
  return headers;
}

async function checkCase(testCase, mode) {
  const includeBearer = mode === "user-token";
  const headers = buildHeaders(includeBearer);
  if (testCase.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const response = await fetchWithTimeout(testCase.path, {
      method: testCase.method,
      headers,
      body: testCase.body !== undefined ? JSON.stringify(testCase.body) : undefined,
    });

    const expectedStatuses = mode === "public" ? [401, 403] : [403];
    const ok = expectedStatuses.includes(response.status);
    console.log(`${ok ? "PASS" : "FAIL"} [${mode}] ${formatLabel(testCase.method, testCase.path)} -> ${response.status}`);

    if (!ok) {
      const bodyPreview = (await response.text().catch(() => "")).trim().slice(0, 300);
      const expectation = mode === "public" ? "expected 401/403 without token" : "expected 403 with SMOKE_USER_BEARER";
      console.log(`  ${expectation}, got ${response.status}`);
      if (bodyPreview) {
        console.log(`  body: ${bodyPreview}`);
      }
      return false;
    }

    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`FAIL [${mode}] ${formatLabel(testCase.method, testCase.path)} -> request error: ${message}`);
    return false;
  }
}

async function runMode(mode) {
  console.log(`${mode === "public" ? "Public" : "User-token"} write-guard smoke cases: ${matrix.length}`);
  const results = await Promise.all(matrix.map((testCase) => checkCase(testCase, mode)));
  return results.filter((result) => !result).length;
}

async function main() {
  console.log(`Admin write-guards smoke base URL: ${baseUrl}`);

  const publicFailed = await runMode("public");

  let userFailed = 0;
  if (userBearer) {
    userFailed = await runMode("user-token");
  } else {
    console.log("SKIP user-token mode (set SMOKE_USER_BEARER to enable)");
  }

  const totalFailed = publicFailed + userFailed;
  if (totalFailed > 0) {
    console.log(`Admin write-guards smoke failed: public_failed=${publicFailed}, user_failed=${userFailed}`);
    process.exitCode = 1;
    return;
  }

  console.log("Admin write-guards smoke passed");
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
