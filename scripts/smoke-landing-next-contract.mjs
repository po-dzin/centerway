const baseUrl = (
  process.env.SMOKE_UI_BASE_URL ||
  process.env.SMOKE_BASE_URL ||
  "http://localhost:8000"
).replace(/\/+$/, "");

const requireNextLanding = (process.env.SMOKE_REQUIRE_NEXT_LANDING || "0").toLowerCase() === "1";

const routes = ["/reboot", "/irem"];
const utilityRoutes = ["/short/thanks.html", "/irem/thanks.html"];
const requiredSnippets = [
  'data-cw-runtime="next"',
  '/shared/css/landing.bridge.css',
  '/shared/js/landing-pixel.js',
  '/shared/js/landing-runtime.js',
];
const forbiddenSnippets = [
  "cw_attrib",
  "Meta Pixel Code",
];
const utilityRequiredSnippets = [
  'data-cw-runtime="next"',
  '/shared/js/landing-pixel.js',
  "fbq('track', 'Purchase'",
  "cw_purchase_fired:",
];

function pass(message) {
  console.log(`PASS ${message}`);
}

function fail(message) {
  console.log(`FAIL ${message}`);
  process.exitCode = 1;
}

async function fetchHtml(pathname) {
  const res = await fetch(`${baseUrl}${pathname}`);
  const text = await res.text();
  return { status: res.status, text };
}

function stripNextFlightScripts(html) {
  return html
    .replace(/<script[^>]*>\s*\(self\.__next_s=self\.__next_s\|\|\[\]\)\.push\([\s\S]*?<\/script>/gi, "")
    .replace(/<script[^>]*>\s*self\.__next_f\.push\([\s\S]*?<\/script>/gi, "");
}

async function main() {
  console.log(`Landing next-contract smoke base URL: ${baseUrl}`);
  console.log(`Require Next landing marker: ${requireNextLanding ? "yes" : "no"}`);

  for (const route of routes) {
    const { status, text } = await fetchHtml(route);
    const checkedHtml = stripNextFlightScripts(text);
    if (status >= 400) {
      fail(`${route}: status ${status}`);
      continue;
    }
    pass(`${route}: status ${status}`);

    const hasNextMarker = checkedHtml.includes('data-cw-runtime="next"');
    if (!hasNextMarker) {
      if (requireNextLanding) {
        fail(`${route}: missing Next landing marker`);
      } else {
        pass(`${route}: Next marker not present (legacy route/fallback)`);
      }
      continue;
    }

    for (const snippet of requiredSnippets) {
      if (!checkedHtml.includes(snippet)) {
        fail(`${route}: missing required snippet "${snippet}"`);
      } else {
        pass(`${route}: has "${snippet}"`);
      }
    }

    for (const snippet of forbiddenSnippets) {
      if (checkedHtml.includes(snippet)) {
        fail(`${route}: found forbidden snippet "${snippet}"`);
      } else {
        pass(`${route}: no forbidden "${snippet}"`);
      }
    }
  }

  for (const route of utilityRoutes) {
    const { status, text } = await fetchHtml(route);
    const checkedHtml = stripNextFlightScripts(text);
    if (status >= 400) {
      fail(`${route}: status ${status}`);
      continue;
    }
    pass(`${route}: status ${status}`);

    for (const snippet of utilityRequiredSnippets) {
      if (!checkedHtml.includes(snippet)) {
        fail(`${route}: missing required snippet "${snippet}"`);
      } else {
        pass(`${route}: has "${snippet}"`);
      }
    }

    if (checkedHtml.includes("localStorage.setItem('cw_attrib'") || checkedHtml.includes('localStorage.setItem("cw_attrib"')) {
      fail(`${route}: found legacy cw_attrib writer`);
    } else {
      pass(`${route}: no legacy cw_attrib writer`);
    }
  }

  if (process.exitCode) process.exit(process.exitCode);
  console.log("Landing next-contract smoke passed");
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
