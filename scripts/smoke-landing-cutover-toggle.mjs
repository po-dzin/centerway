import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";

const host = process.env.SMOKE_HOST || "127.0.0.1";
const portBase = Number.parseInt(process.env.SMOKE_PORT_BASE || "8010", 10);
const startupTimeoutMs = Number.parseInt(process.env.SMOKE_STARTUP_TIMEOUT_MS || "90000", 10);
const requestTimeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || "15000", 10);

const entryRoutes = ["/reboot", "/irem"];
const utilityRoutes = ["/short/thanks.html", "/irem/thanks.html", "/short/public-offer.html", "/irem/public-offer.html"];
const requiredNextSnippets = [
  'data-cw-runtime="next"',
  '/shared/css/landing.bridge.css',
  "/shared/js/landing-pixel.js",
  "/shared/js/landing-runtime.js",
];
const forbiddenNextSnippets = ["cw_attrib", "Meta Pixel Code"];
const landingContentFile = path.join(process.cwd(), "src/lib/landing/content.ts");
const typedHeroKeys = ["badge", "title", "subtitle", "lead", "note", "ctaPrimaryLabel", "ctaStickyLabel", "priceCurrent"];

function modePort(offset) {
  return portBase + offset;
}

function pass(message) {
  console.log(`PASS ${message}`);
}

function fail(message, details = []) {
  console.log(`FAIL ${message}`);
  for (const detail of details) {
    console.log(`  - ${detail}`);
  }
  process.exitCode = 1;
}

function withTimeout(ms) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeout),
  };
}

function stripNextFlightScripts(html) {
  return html
    .replace(/<script[^>]*>\s*\(self\.__next_s=self\.__next_s\|\|\[\]\)\.push\([\s\S]*?<\/script>/gi, "")
    .replace(/<script[^>]*>\s*self\.__next_f\.push\([\s\S]*?<\/script>/gi, "");
}

function readLandingContentSource() {
  return fs.readFileSync(landingContentFile, "utf8");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseTypedHeroStringsByProduct() {
  const source = readLandingContentSource();
  const products = ["short", "irem"];
  const byProduct = {};

  for (const product of products) {
    const productBlockRegex = new RegExp(
      `${escapeRegExp(product)}\\s*:\\s*\\{[\\s\\S]*?hero\\s*:\\s*\\{([\\s\\S]*?)\\}\\s*,\\s*utility\\s*:`,
      "m"
    );
    const productMatch = source.match(productBlockRegex);
    if (!productMatch) {
      throw new Error(`typed hero parse failed: missing product block for ${product}`);
    }

    const heroBlock = productMatch[1];
    const heroStrings = [];

    for (const key of typedHeroKeys) {
      const keyRegex = new RegExp(`${escapeRegExp(key)}\\s*:\\s*"([^"]+)"`, "m");
      const keyMatch = heroBlock.match(keyRegex);
      if (!keyMatch) {
        throw new Error(`typed hero parse failed: missing key ${product}.hero.${key}`);
      }
      heroStrings.push({ key, value: keyMatch[1] });
    }

    byProduct[product] = heroStrings;
  }

  return byProduct;
}

async function fetchHtml(baseUrl, pathname) {
  const timer = withTimeout(requestTimeoutMs);
  try {
    const res = await fetch(`${baseUrl}${pathname}`, {
      signal: timer.signal,
      redirect: "follow",
    });
    const text = await res.text();
    return { status: res.status, text };
  } finally {
    timer.clear();
  }
}

async function waitForServer(baseUrl) {
  const startedAt = Date.now();
  let lastError = "unknown";
  while (Date.now() - startedAt < startupTimeoutMs) {
    try {
      const { status } = await fetchHtml(baseUrl, "/");
      if (status < 500) return;
      lastError = `status ${status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`server at ${baseUrl} did not become ready: ${lastError}`);
}

function assertPortAvailable(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", (error) => {
      const message = error instanceof Error ? error.message : String(error);
      reject(new Error(`port ${port} is not available: ${message}`));
    });
    server.once("listening", () => {
      server.close((closeError) => {
        if (closeError) {
          const message = closeError instanceof Error ? closeError.message : String(closeError);
          reject(new Error(`port ${port} availability check close failed: ${message}`));
          return;
        }
        resolve();
      });
    });
    server.listen(port, host);
  });
}

function spawnNextDev(port, nextEnabled, typedHeroEnabled) {
  const state = { startupError: null };
  const child = spawn(
    "node",
    ["node_modules/next/dist/bin/next", "dev", "-p", String(port), "--hostname", host],
    {
    env: {
      ...process.env,
      HOSTNAME: host,
      CW_NEXT_LANDING_SHORT_IREM: nextEnabled ? "1" : "0",
      CW_TYPED_HERO_SHORT_IREM: typedHeroEnabled ? "1" : "0",
    },
    stdio: "pipe",
    }
  );

  child.stdout?.on("data", (chunk) => {
    const text = String(chunk);
    if (/Failed to start server|Unable to acquire lock|EADDRINUSE|EPERM: operation not permitted/i.test(text)) {
      state.startupError = text.trim();
    }
    process.stdout.write(`[next:${nextEnabled ? "on" : "off"} typed:${typedHeroEnabled ? "on" : "off"}] ${text}`);
  });
  child.stderr?.on("data", (chunk) => {
    const text = String(chunk);
    if (/Failed to start server|Unable to acquire lock|EADDRINUSE|EPERM: operation not permitted/i.test(text)) {
      state.startupError = text.trim();
    }
    process.stderr.write(`[next:${nextEnabled ? "on" : "off"} typed:${typedHeroEnabled ? "on" : "off"}] ${text}`);
  });

  return { child, state };
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  await new Promise((resolve) => {
    child.once("exit", () => resolve());
    child.kill("SIGTERM");
    setTimeout(() => child.kill("SIGKILL"), 5000);
  });
}

async function assertMode(baseUrl, nextExpected, typedHeroEnabled) {
  const heroStringsByProduct = typedHeroEnabled ? parseTypedHeroStringsByProduct() : null;
  const entryHtmlByRoute = {};
  for (const route of entryRoutes) {
    const { status, text } = await fetchHtml(baseUrl, route);
    const html = stripNextFlightScripts(text);
    entryHtmlByRoute[route] = html;
    if (status >= 400) {
      fail(`${route}: status ${status}`);
      continue;
    }
    pass(`${route}: status ${status}`);

    const hasNextMarker = html.includes('data-cw-runtime="next"');
    if (hasNextMarker !== nextExpected) {
      fail(`${route}: next marker mismatch (expected ${nextExpected}, got ${hasNextMarker})`);
      continue;
    }
    pass(`${route}: next marker ${nextExpected ? "present" : "absent"} as expected`);

    if (!nextExpected) continue;

    if (typedHeroEnabled && heroStringsByProduct) {
      const product = route === "/reboot" ? "short" : "irem";
      const heroStrings = heroStringsByProduct[product] ?? [];
      for (const { key, value } of heroStrings) {
        if (!html.includes(value)) {
          fail(`${route}: typed hero missing ${product}.hero.${key}="${value}"`);
        } else {
          pass(`${route}: typed hero has ${product}.hero.${key}`);
        }
      }
    }

    for (const snippet of requiredNextSnippets) {
      if (!html.includes(snippet)) {
        fail(`${route}: missing required snippet "${snippet}"`);
      } else {
        pass(`${route}: has "${snippet}"`);
      }
    }

    for (const snippet of forbiddenNextSnippets) {
      if (html.includes(snippet)) {
        fail(`${route}: found forbidden snippet "${snippet}"`);
      } else {
        pass(`${route}: no forbidden "${snippet}"`);
      }
    }
  }

  for (const route of utilityRoutes) {
    const { status, text } = await fetchHtml(baseUrl, route);
    const html = stripNextFlightScripts(text);
    if (status >= 400) {
      fail(`${route}: status ${status}`);
      continue;
    }
    pass(`${route}: status ${status}`);

    const hasNextMarker = html.includes('data-cw-runtime="next"');
    if (hasNextMarker !== nextExpected) {
      fail(`${route}: next marker mismatch (expected ${nextExpected}, got ${hasNextMarker})`);
      continue;
    }
    pass(`${route}: next marker ${nextExpected ? "present" : "absent"} as expected`);
  }

  return { entryHtmlByRoute };
}

async function runMode(nextEnabled, typedHeroEnabled, portOffset) {
  const port = modePort(portOffset);
  const baseUrl = `http://${host}:${port}`;
  await assertPortAvailable(port);
  const { child: server, state } = spawnNextDev(port, nextEnabled, typedHeroEnabled);
  try {
    await waitForServer(baseUrl);
    if (server.exitCode !== null || state.startupError) {
      throw new Error(
        `next dev failed to start for ${baseUrl} (next=${nextEnabled ? "on" : "off"}, typed=${
          typedHeroEnabled ? "on" : "off"
        }): ${state.startupError ?? `exitCode=${server.exitCode}`}`
      );
    }
    console.log(
      `Cutover mode check base URL: ${baseUrl} (next=${nextEnabled ? "on" : "off"}, typed=${
        typedHeroEnabled ? "on" : "off"
      })`
    );
    return await assertMode(baseUrl, nextEnabled, typedHeroEnabled);
  } finally {
    await stopServer(server);
  }
}

function assertEntryHeroParityBetweenTypedModes(typedOnResult, typedOffResult) {
  const heroStringsByProduct = parseTypedHeroStringsByProduct();
  for (const route of entryRoutes) {
    const product = route === "/reboot" ? "short" : "irem";
    const heroStrings = heroStringsByProduct[product] ?? [];
    const typedOnHtml = typedOnResult.entryHtmlByRoute[route] ?? "";
    const typedOffHtml = typedOffResult.entryHtmlByRoute[route] ?? "";

    const missingInOn = heroStrings.filter(({ value }) => !typedOnHtml.includes(value));
    const missingInOff = heroStrings.filter(({ value }) => !typedOffHtml.includes(value));
    if (missingInOn.length || missingInOff.length) {
      const details = [
        ...missingInOn.map(({ key, value }) => `typed=on missing ${product}.hero.${key}="${value}"`),
        ...missingInOff.map(({ key, value }) => `typed=off missing ${product}.hero.${key}="${value}"`),
      ];
      fail(`${route}: hero parity drift between typed=on and typed=off`, details);
      continue;
    }
    pass(`${route}: hero parity typed=on/off`);
  }
}

async function main() {
  const typedOnResult = await runMode(true, true, 0);
  const typedOffResult = await runMode(true, false, 1);
  assertEntryHeroParityBetweenTypedModes(typedOnResult, typedOffResult);
  await runMode(false, false, 2);

  if (process.exitCode) process.exit(process.exitCode);
  console.log("Landing cutover toggle contract passed");
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
