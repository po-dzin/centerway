const baseUrl = (
  process.env.SMOKE_UI_BASE_URL ||
  process.env.SMOKE_BASE_URL ||
  "http://localhost:8000"
).replace(/\/+$/, "");

const smokeTgUserId = process.env.SMOKE_DYNAMIC_TG_USER_ID || "";

function pass(message) {
  console.log(`PASS ${message}`);
}

function skip(message) {
  console.log(`SKIP ${message}`);
}

function fail(message) {
  console.log(`FAIL ${message}`);
  process.exitCode = 1;
}

function readOfferToken(location) {
  const parsed = new URL(location);
  return parsed.searchParams.get("offer_token");
}

async function requestDynamicOffer(pathname) {
  return fetch(`${baseUrl}${pathname}`, {
    method: "GET",
    redirect: "manual",
  });
}

async function main() {
  console.log(`Landing dynamic-offer smoke base URL: ${baseUrl}`);

  if (!smokeTgUserId.trim()) {
    skip("SMOKE_DYNAMIC_TG_USER_ID is not set");
    return;
  }

  const campaign = `smoke_dynamic_${Date.now()}`;
  const pathname = `/go/irem?tgUserId=${encodeURIComponent(smokeTgUserId)}&campaign=${encodeURIComponent(campaign)}&utm_source=smoke_dynamic`;

  const first = await requestDynamicOffer(pathname);
  if (first.status !== 302) {
    fail(`first dynamic redirect expected 302, got ${first.status}`);
    return;
  }

  const firstLocation = first.headers.get("location");
  if (!firstLocation) {
    fail("first dynamic redirect missing location header");
    return;
  }

  const firstToken = readOfferToken(firstLocation);
  if (!firstToken) {
    fail("first dynamic redirect missing offer_token");
    return;
  }

  if (!firstLocation.includes("utm_source=smoke_dynamic")) {
    fail("first dynamic redirect did not preserve utm_source");
    return;
  }

  pass("first dynamic redirect returns landing URL with offer_token");

  const second = await requestDynamicOffer(pathname);
  if (second.status !== 302) {
    fail(`second dynamic redirect expected 302, got ${second.status}`);
    return;
  }

  const secondLocation = second.headers.get("location");
  if (!secondLocation) {
    fail("second dynamic redirect missing location header");
    return;
  }

  const secondToken = readOfferToken(secondLocation);
  if (!secondToken) {
    fail("second dynamic redirect missing offer_token");
    return;
  }

  if (secondToken !== firstToken) {
    fail("dynamic redirect did not reuse the live offer token for the same tgUserId and campaign");
    return;
  }

  pass("dynamic redirect reuses the same live offer token");
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
