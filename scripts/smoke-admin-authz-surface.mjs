const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");
const timeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || "10000", 10);

const matrix = [
  { method: "GET", path: "/api/admin/analytics" },
  { method: "GET", path: "/api/admin/audit" },
  { method: "GET", path: "/api/admin/orders" },
  { method: "PATCH", path: "/api/admin/orders", body: { order_ref: "smoke-order", status: "paid" } },
  { method: "GET", path: "/api/admin/jobs" },
  { method: "POST", path: "/api/admin/jobs/smoke/retry" },
  { method: "GET", path: "/api/admin/customers" },
  { method: "GET", path: "/api/admin/customers/smoke" },
  { method: "PATCH", path: "/api/admin/customers/smoke", body: { display_name: "Smoke" } },
  { method: "POST", path: "/api/admin/system/pulse" },
  { method: "PATCH", path: "/api/admin/analytics/marketing", body: { spend: 0 } },
  { method: "POST", path: "/api/admin/analytics/sync-meta" },
  { method: "POST", path: "/api/admin/bootstrap-role" },
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
