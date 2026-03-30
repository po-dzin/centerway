const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");
const timeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || "10000", 10);
const bearerToken = process.env.SMOKE_ADMIN_BEARER || "";
const requireAuthChecks = process.argv.includes("--require-auth");

const unauthorizedMatrix = [
  { method: "GET", path: "/api/admin/analytics" },
  { method: "GET", path: "/api/admin/orders" },
  { method: "PATCH", path: "/api/admin/orders", body: { order_ref: "smoke-order", status: "paid" } },
  { method: "GET", path: "/api/admin/jobs" },
  { method: "POST", path: "/api/admin/jobs/smoke-job/retry" },
  { method: "GET", path: "/api/admin/customers" },
  { method: "GET", path: "/api/admin/customers/smoke-customer" },
  { method: "PATCH", path: "/api/admin/customers/smoke-customer", body: { display_name: "Smoke" } },
  { method: "GET", path: "/api/admin/audit" },
  { method: "POST", path: "/api/admin/system/pulse" },
  { method: "PATCH", path: "/api/admin/analytics/marketing", body: { spend: 0 } },
  { method: "POST", path: "/api/admin/analytics/sync-meta" },
  { method: "POST", path: "/api/admin/bootstrap-role" },
];

const authenticatedContracts = [
  { method: "GET", path: "/api/admin/analytics", expectedKeys: ["summary", "funnel", "campaigns", "funnel_chain", "freshness"] },
  { method: "GET", path: "/api/admin/orders?limit=1", expectedKeys: ["data", "count", "totalPaid"] },
  { method: "GET", path: "/api/admin/jobs?limit=1", expectedKeys: ["data", "count"] },
  { method: "GET", path: "/api/admin/customers?limit=1", expectedKeys: ["data", "count"] },
  { method: "GET", path: "/api/admin/audit?limit=1", expectedKeys: ["items", "total", "limit", "offset"] },
];

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

async function checkUnauthorizedCase(testCase) {
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
    const statusLabel = ok ? "PASS" : "FAIL";
    console.log(`${statusLabel} ${formatLabel(testCase.method, testCase.path)} -> ${response.status}`);

    if (!ok) {
      const bodyPreview = (await response.text().catch(() => "")).trim().slice(0, 300);
      console.log(`  expected 401/403 without token, got ${response.status}`);
      if (bodyPreview) console.log(`  body: ${bodyPreview}`);
      return false;
    }
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`FAIL ${formatLabel(testCase.method, testCase.path)} -> request error: ${message}`);
    return false;
  }
}

async function checkAuthenticatedContract(testCase) {
  const headers = {
    Accept: "application/json, text/plain, */*",
    Authorization: `Bearer ${bearerToken}`,
  };

  try {
    const response = await fetchWithTimeout(testCase.path, { method: testCase.method, headers });
    if (response.status !== 200) {
      const bodyPreview = (await response.text().catch(() => "")).trim().slice(0, 300);
      console.log(`FAIL ${formatLabel(testCase.method, testCase.path)} -> expected 200, got ${response.status}`);
      if (bodyPreview) console.log(`  body: ${bodyPreview}`);
      return false;
    }

    const json = await response.json().catch(() => null);
    if (!json || typeof json !== "object") {
      console.log(`FAIL ${formatLabel(testCase.method, testCase.path)} -> response is not JSON object`);
      return false;
    }

    const missing = testCase.expectedKeys.filter((key) => !(key in json));
    if (missing.length > 0) {
      console.log(`FAIL ${formatLabel(testCase.method, testCase.path)} -> missing keys: ${missing.join(", ")}`);
      return false;
    }

    console.log(`PASS ${formatLabel(testCase.method, testCase.path)} -> 200 with expected contract keys`);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.log(`FAIL ${formatLabel(testCase.method, testCase.path)} -> request error: ${message}`);
    return false;
  }
}

async function main() {
  console.log(`Admin smoke base URL: ${baseUrl}`);
  console.log(`Unauth matrix cases: ${unauthorizedMatrix.length}`);

  const unauthResults = await Promise.all(unauthorizedMatrix.map((testCase) => checkUnauthorizedCase(testCase)));
  const unauthFailed = unauthResults.filter((result) => !result).length;

  let authFailed = 0;
  if (bearerToken) {
    console.log(`Authenticated contract checks: ${authenticatedContracts.length}`);
    const authResults = await Promise.all(authenticatedContracts.map((testCase) => checkAuthenticatedContract(testCase)));
    authFailed = authResults.filter((result) => !result).length;
  } else if (requireAuthChecks) {
    console.log("FAIL authenticated checks required but SMOKE_ADMIN_BEARER is missing");
    process.exitCode = 1;
    return;
  } else {
    console.log("SKIP authenticated checks (set SMOKE_ADMIN_BEARER or run with --require-auth)");
  }

  const totalFailed = unauthFailed + authFailed;
  if (totalFailed > 0) {
    console.log(`Admin smoke failed: unauth_failed=${unauthFailed}, auth_failed=${authFailed}`);
    process.exitCode = 1;
    return;
  }

  console.log("Admin smoke passed");
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
