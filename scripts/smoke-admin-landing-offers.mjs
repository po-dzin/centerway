const baseUrl = (process.env.SMOKE_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");
const timeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || "10000", 10);
const bearerToken = process.env.SMOKE_ADMIN_BEARER || "";

function fail(message) {
  console.log(`FAIL ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`PASS ${message}`);
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

async function main() {
  console.log(`Admin landing-offers smoke base URL: ${baseUrl}`);

  if (!bearerToken) {
    console.log("SKIP SMOKE_ADMIN_BEARER is not set");
    return;
  }

  const payload = {
    product: "irem",
    recipient_key: `smoke:${Date.now()}`,
    channel: "telegram",
    campaign: "smoke_admin",
    note: "landing-offers smoke",
  };

  const response = await fetchWithTimeout("/api/admin/landing-offers", {
    method: "POST",
    headers: {
      Accept: "application/json, text/plain, */*",
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (response.status !== 200) {
    const bodyPreview = (await response.text().catch(() => "")).trim().slice(0, 500);
    fail(`POST /api/admin/landing-offers expected 200, got ${response.status}`);
    if (bodyPreview) console.log(`  body: ${bodyPreview}`);
    return;
  }

  const json = await response.json().catch(() => null);
  if (!json || json.ok !== true || !json.offer || typeof json.offer !== "object") {
    fail("response is missing ok=true or offer object");
    return;
  }

  const offer = json.offer;
  const requiredKeys = ["offerToken", "landingUrl", "status", "offerId", "product", "amount", "oldAmount", "currency"];
  const missing = requiredKeys.filter((key) => !(key in offer));
  if (missing.length > 0) {
    fail(`offer contract is missing keys: ${missing.join(", ")}`);
    return;
  }

  if (offer.product !== "irem") {
    fail(`expected product=irem, got ${String(offer.product)}`);
    return;
  }

  if (offer.status !== "draft") {
    fail(`expected status=draft, got ${String(offer.status)}`);
    return;
  }

  if (typeof offer.offerToken !== "string" || offer.offerToken.length < 20) {
    fail("offerToken is missing or too short");
    return;
  }

  if (typeof offer.landingUrl !== "string" || !offer.landingUrl.includes(`offer_token=${offer.offerToken}`)) {
    fail("landingUrl does not contain the issued offer token");
    return;
  }

  if (typeof json.batchId !== "string" || json.batchId.length < 10) {
    fail("single response is missing batchId");
    return;
  }

  pass("POST /api/admin/landing-offers returns a valid single issued-link contract");

  const batchPayload = {
    product: "irem",
    entries: [
      {
        recipient_key: `smoke:batch:${Date.now()}:1`,
        channel: "telegram",
        campaign: "smoke_admin",
        note: "landing-offers smoke batch",
      },
      {
        recipient_key: `smoke:batch:${Date.now()}:2`,
        channel: "telegram",
        campaign: "smoke_admin",
        note: "landing-offers smoke batch",
      },
    ],
  };

  const batchResponse = await fetchWithTimeout("/api/admin/landing-offers", {
    method: "POST",
    headers: {
      Accept: "application/json, text/plain, */*",
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(batchPayload),
  });

  if (batchResponse.status !== 200) {
    const bodyPreview = (await batchResponse.text().catch(() => "")).trim().slice(0, 500);
    fail(`batch POST /api/admin/landing-offers expected 200, got ${batchResponse.status}`);
    if (bodyPreview) console.log(`  body: ${bodyPreview}`);
    return;
  }

  const batchJson = await batchResponse.json().catch(() => null);
  if (!batchJson || batchJson.ok !== true || !Array.isArray(batchJson.offers) || !batchJson.summary) {
    fail("batch response is missing ok=true, offers array, or summary");
    return;
  }

  if (typeof batchJson.batchId !== "string" || batchJson.batchId.length < 10) {
    fail("batch response is missing batchId");
    return;
  }

  if (batchJson.offers.length !== 2) {
    fail(`expected 2 issued offers in batch response, got ${batchJson.offers.length}`);
    return;
  }

  if (batchJson.summary.totalIssued !== 2) {
    fail(`expected batch summary.totalIssued=2, got ${String(batchJson.summary.totalIssued)}`);
    return;
  }

  pass("POST /api/admin/landing-offers returns a valid batch issued-link contract");
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
