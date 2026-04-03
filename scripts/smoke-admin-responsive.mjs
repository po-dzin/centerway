import { chromium } from "@playwright/test";

const baseUrl = (
  process.env.SMOKE_UI_BASE_URL ||
  process.env.SMOKE_BASE_URL ||
  ""
).replace(/\/+$/, "");

const timeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || "20000", 10);

const routes = [
  "/admin",
  "/admin/analytics",
  "/admin/orders",
  "/admin/customers",
  "/admin/jobs",
  "/admin/system",
  "/admin/system/audit",
];

const viewports = [
  { width: 375, height: 812 },
  { width: 768, height: 900 },
  { width: 1024, height: 900 },
  { width: 1440, height: 1000 },
];

function fail(message) {
  console.log(`FAIL ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`PASS ${message}`);
}

async function main() {
  if (!baseUrl) {
    console.log("SKIP responsive smoke: SMOKE_UI_BASE_URL or SMOKE_BASE_URL is required");
    return;
  }

  console.log(`Admin responsive smoke base URL: ${baseUrl}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const pageErrors = [];
  page.on("pageerror", (error) => {
    pageErrors.push(String(error?.message || error));
  });

  try {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      for (const route of routes) {
        const targetUrl = `${baseUrl}${route}`;
        const response = await page.goto(targetUrl, {
          waitUntil: "domcontentloaded",
          timeout: timeoutMs,
        });

        if (!response) {
          fail(`${route} @${viewport.width}: no main document response`);
          continue;
        }

        const status = response.status();
        if (status >= 500) {
          fail(`${route} @${viewport.width}: status ${status}`);
          continue;
        }

        const overflow = await page.evaluate(() => {
          const html = document.documentElement;
          return html.scrollWidth - html.clientWidth;
        });
        if (overflow > 1) {
          fail(`${route} @${viewport.width}: horizontal overflow ${overflow}px`);
        } else {
          pass(`${route} @${viewport.width}: no horizontal overflow`);
        }

        const hasMain = await page.locator("main").count();
        if (hasMain < 1) {
          fail(`${route} @${viewport.width}: missing <main>`);
        } else {
          pass(`${route} @${viewport.width}: main present`);
        }
      }
    }

    if (pageErrors.length > 0) {
      for (const err of pageErrors) {
        fail(`pageerror: ${err}`);
      }
    } else {
      pass("no pageerror events across responsive matrix");
    }
  } finally {
    await context.close();
    await browser.close();
  }

  if (process.exitCode) process.exit(process.exitCode);
  console.log("Admin responsive smoke passed");
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
