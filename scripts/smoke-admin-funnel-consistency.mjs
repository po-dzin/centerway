const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");
const bearerToken = process.env.SMOKE_ADMIN_BEARER || "";

function fail(message) {
  console.log(`FAIL ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`PASS ${message}`);
}

function isFiniteNonNegativeNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

async function fetchJson(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "GET",
    headers: {
      Accept: "application/json, text/plain, */*",
      Authorization: `Bearer ${bearerToken}`,
    },
    redirect: "manual",
  });

  const text = await response.text();
  return { response, text };
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function checkRequiredKeys(json, keys) {
  let ok = true;
  for (const key of keys) {
    if (key in json) {
      pass(`response includes key ${key}`);
    } else {
      fail(`response is missing required key ${key}`);
      ok = false;
    }
  }
  return ok;
}

async function main() {
  console.log(`Smoke base URL: ${baseUrl}`);

  if (!bearerToken) {
    console.error("ERROR SMOKE_ADMIN_BEARER is required for this smoke test");
    process.exit(1);
  }

  let response;
  let text;
  try {
    ({ response, text } = await fetchJson("/api/admin/analytics"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    fail(`request to GET /api/admin/analytics failed: ${message}`);
    process.exit(process.exitCode || 1);
  }

  if (response.status !== 200) {
    const preview = text.trim().slice(0, 300);
    fail(`GET /api/admin/analytics returned ${response.status}`);
    if (preview) {
      console.log(`  body: ${preview}`);
    }
    process.exit(process.exitCode || 1);
  }
  pass(`GET /api/admin/analytics returned 200`);

  const json = parseJson(text);
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    fail("response body is not a JSON object");
    process.exit(process.exitCode || 1);
  }

  const requiredKeysOk = checkRequiredKeys(json, ["summary", "funnel_chain", "capi_overview", "freshness"]);

  const summary = json.summary;
  if (!summary || typeof summary !== "object" || Array.isArray(summary)) {
    fail("summary is missing or not an object");
  } else {
    const summaryRules = [
      ["summary.totalLeads is a finite non-negative number", isFiniteNonNegativeNumber(summary.totalLeads)],
      ["summary.totalPaidOrders is a finite non-negative number", isFiniteNonNegativeNumber(summary.totalPaidOrders)],
      ["summary.totalRevenue is a finite non-negative number", isFiniteNonNegativeNumber(summary.totalRevenue)],
    ];
    for (const [label, ok] of summaryRules) {
      if (ok) pass(label);
      else fail(label);
    }
  }

  const funnelChain = json.funnel_chain;
  if (!funnelChain || typeof funnelChain !== "object" || Array.isArray(funnelChain)) {
    fail("funnel_chain is missing or not an object");
  } else {
    const funnelRules = [
      ["funnel_chain.view_content is a finite non-negative number", isFiniteNonNegativeNumber(funnelChain.view_content)],
      ["funnel_chain.initiate_checkout is a finite non-negative number", isFiniteNonNegativeNumber(funnelChain.initiate_checkout)],
      ["funnel_chain.purchase is a finite non-negative number", isFiniteNonNegativeNumber(funnelChain.purchase)],
      ["funnel_chain.access_granted is a finite non-negative number", isFiniteNonNegativeNumber(funnelChain.access_granted)],
    ];
    for (const [label, ok] of funnelRules) {
      if (ok) pass(label);
      else fail(label);
    }

    if (isFiniteNonNegativeNumber(funnelChain.purchase) && isFiniteNonNegativeNumber(funnelChain.initiate_checkout)) {
      if (funnelChain.purchase <= funnelChain.initiate_checkout) {
        pass("funnel_chain.purchase is less than or equal to funnel_chain.initiate_checkout");
      } else {
        fail(
          `funnel_chain.purchase (${funnelChain.purchase}) is greater than funnel_chain.initiate_checkout (${funnelChain.initiate_checkout})`
        );
      }
    }
  }

  const capiOverview = json.capi_overview;
  if (!capiOverview || typeof capiOverview !== "object" || Array.isArray(capiOverview)) {
    fail("capi_overview is missing or not an object");
  } else {
    const capiRules = [
      ["capi_overview.total is a finite non-negative number", isFiniteNonNegativeNumber(capiOverview.total)],
      ["capi_overview.success is a finite non-negative number", isFiniteNonNegativeNumber(capiOverview.success)],
      ["capi_overview.pending is a finite non-negative number", isFiniteNonNegativeNumber(capiOverview.pending)],
      ["capi_overview.running is a finite non-negative number", isFiniteNonNegativeNumber(capiOverview.running)],
      ["capi_overview.failed is a finite non-negative number", isFiniteNonNegativeNumber(capiOverview.failed)],
    ];
    for (const [label, ok] of capiRules) {
      if (ok) pass(label);
      else fail(label);
    }

    if (
      isFiniteNonNegativeNumber(capiOverview.total) &&
      isFiniteNonNegativeNumber(capiOverview.success) &&
      isFiniteNonNegativeNumber(capiOverview.pending) &&
      isFiniteNonNegativeNumber(capiOverview.running) &&
      isFiniteNonNegativeNumber(capiOverview.failed)
    ) {
      const statusSum = capiOverview.success + capiOverview.pending + capiOverview.running + capiOverview.failed;
      if (capiOverview.total >= statusSum) {
        pass("capi_overview.total is greater than or equal to the sum of success, pending, running, and failed");
      } else {
        fail(`capi_overview.total (${capiOverview.total}) is less than the sum of statuses (${statusSum})`);
      }
    }
  }

  if (process.exitCode) {
    process.exit(1);
  }

  console.log("Admin funnel consistency smoke passed");
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
