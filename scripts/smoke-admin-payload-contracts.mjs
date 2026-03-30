const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");
const timeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || "10000", 10);
const bearerToken = process.env.SMOKE_ADMIN_BEARER || "";

const publicCases = [
  { method: "PATCH", path: "/api/admin/orders", body: { order_ref: "smoke", status: "paid" } },
  { method: "POST", path: "/api/admin/jobs/smoke/retry" },
  { method: "PATCH", path: "/api/admin/customers/smoke", body: { display_name: "Smoke" } },
  { method: "POST", path: "/api/admin/system/pulse" },
  { method: "PATCH", path: "/api/admin/analytics/marketing", body: { spend: 0 } },
  { method: "POST", path: "/api/admin/analytics/sync-meta" },
  { method: "POST", path: "/api/admin/bootstrap-role" },
];

const safeAuthCases = [
  { method: "PATCH", path: "/api/admin/orders", body: { order_ref: 0, status: ["paid"] } },
  { method: "PATCH", path: "/api/admin/customers/smoke", body: { display_name: { value: "Smoke" } } },
  { method: "PATCH", path: "/api/admin/analytics/marketing", body: { spend: "invalid" } },
];

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

  const publicFailed = await runMode("public", publicCases);

  let authFailed = 0;
  if (bearerToken) {
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
