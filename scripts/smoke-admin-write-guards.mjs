const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");
const timeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || "10000", 10);
const userBearer = process.env.SMOKE_USER_BEARER || "";

const matrix = [
  { method: "PATCH", path: "/api/admin/orders", body: { order_ref: "smoke-order", status: "paid" } },
  { method: "POST", path: "/api/admin/jobs/smoke/retry" },
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
