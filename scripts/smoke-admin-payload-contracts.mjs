import fs from "node:fs";
import path from "node:path";

const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");
const timeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || "10000", 10);
const bearerToken = process.env.SMOKE_ADMIN_BEARER || "";

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
  ["PATCH /api/admin/orders", { order_ref: "smoke", status: "paid" }],
  ["PATCH /api/admin/customers/smoke", { display_name: "Smoke" }],
  ["PATCH /api/admin/analytics/marketing", { spend: 0 }],
]);

function normalizeCase(entry) {
  const method = String(entry.method || "").toUpperCase();
  const pathValue = String(entry.path || "");
  const body = entry.body !== undefined ? entry.body : bodyFallbacks.get(`${method} ${pathValue}`);
  return { method, path: pathValue, body };
}

function loadPublicCases() {
  return loadMutateMatrix().map(normalizeCase);
}

const contractKeys = ["error", "message", "ok", "success"];

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
    headers.Authorization = `Bearer ${bearerToken}`;
  }
  return headers;
}

async function readJsonBody(response) {
  const text = await response.text().catch(() => "");
  const raw = text.trim();

  if (!raw) {
    return { ok: false, value: null, raw };
  }

  try {
    return { ok: true, value: JSON.parse(raw), raw };
  } catch {
    return { ok: false, value: null, raw };
  }
}

function hasContractKey(body) {
  return contractKeys.some((key) => Object.prototype.hasOwnProperty.call(body, key));
}

function makeMalformedBody(body) {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return "invalid";
  }

  const malformed = Array.isArray(body) ? [...body] : { ...body };
  const keys = Object.keys(malformed);
  if (keys.length === 0) {
    return "invalid";
  }

  const key = keys[0];
  const value = malformed[key];
  if (typeof value === "string") {
    malformed[key] = 0;
  } else if (typeof value === "number") {
    malformed[key] = "invalid";
  } else if (typeof value === "boolean") {
    malformed[key] = "invalid";
  } else if (Array.isArray(value)) {
    malformed[key] = "invalid";
  } else if (value && typeof value === "object") {
    malformed[key] = null;
  } else {
    malformed[key] = "invalid";
  }

  return malformed;
}

async function checkCase(testCase, mode) {
  const headers = buildHeaders(mode === "auth");
  if (testCase.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const expectedStatusLabel = mode === "public" ? "401/403" : "4xx";
  const expectedStatusOk =
    mode === "public"
      ? (status) => status === 401 || status === 403
      : (status) => status >= 400 && status < 500;

  try {
    const response = await fetchWithTimeout(testCase.path, {
      method: testCase.method,
      headers,
      body: testCase.body !== undefined ? JSON.stringify(testCase.body) : undefined,
    });

    const label = formatLabel(testCase.method, testCase.path);
    const statusOk = expectedStatusOk(response.status);
    console.log(`${statusOk ? "PASS" : "FAIL"} [${mode}] ${label} status -> ${response.status} (expected ${expectedStatusLabel})`);

    const bodyResult = await readJsonBody(response);
    const bodyIsObject = bodyResult.ok && bodyResult.value !== null && typeof bodyResult.value === "object" && !Array.isArray(bodyResult.value);
    console.log(`${bodyIsObject ? "PASS" : "FAIL"} [${mode}] ${label} body -> ${bodyIsObject ? "JSON object" : "not a JSON object"}`);

    const contractOk = bodyIsObject && hasContractKey(bodyResult.value);
    console.log(
      `${contractOk ? "PASS" : "FAIL"} [${mode}] ${label} contract -> ${contractOk ? "contains one of [error, message, ok, success]" : "missing contract key"}`
    );

    if (!statusOk || !bodyIsObject || !contractOk) {
      const bodyPreview = bodyResult.raw.slice(0, 300);
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

async function runMode(mode, matrix) {
  console.log(`${mode === "public" ? "Public" : "Authenticated"} payload-contract cases: ${matrix.length}`);
  const results = await Promise.all(matrix.map((testCase) => checkCase(testCase, mode)));
  return results.filter((result) => !result).length;
}

async function main() {
  console.log(`Admin payload-contract smoke base URL: ${baseUrl}`);

  const publicCases = loadPublicCases();
  const publicFailed = await runMode("public", publicCases);

  let authFailed = 0;
  if (bearerToken) {
    const safeAuthCases = publicCases
      .filter((testCase) => testCase.body !== undefined)
      .map((testCase) => ({
        method: testCase.method,
        path: testCase.path,
        body: makeMalformedBody(testCase.body),
      }));
    authFailed = await runMode("auth", safeAuthCases);
  } else {
    console.log("SKIP authenticated safe PATCH cases (set SMOKE_ADMIN_BEARER to enable)");
  }

  const totalFailed = publicFailed + authFailed;
  if (totalFailed > 0) {
    console.log(`Admin payload-contract smoke failed: public_failed=${publicFailed}, auth_failed=${authFailed}`);
    process.exitCode = 1;
    return;
  }

  console.log("Admin payload-contract smoke passed");
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
