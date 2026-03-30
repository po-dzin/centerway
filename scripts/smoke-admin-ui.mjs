import { chromium } from "@playwright/test";

const baseUrl = (
  process.env.SMOKE_UI_BASE_URL ||
  process.env.SMOKE_BASE_URL ||
  "http://localhost:8000"
).replace(/\/+$/, "");

const timeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || "15000", 10);

const routes = [
  "/admin",
  "/admin/analytics",
  "/admin/system/audit",
];

function fail(message) {
  console.log(`FAIL ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`PASS ${message}`);
}

async function main() {
  console.log(`Admin UI smoke base URL: ${baseUrl}`);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const pageErrors = [];
  page.on("pageerror", (error) => {
    pageErrors.push(String(error?.message || error));
  });

  try {
    for (const route of routes) {
      const targetUrl = `${baseUrl}${route}`;
      const response = await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });

      if (!response) {
        fail(`${route}: no main document response`);
        continue;
      }

      const status = response.status();
      if (status >= 500) {
        fail(`${route}: main document status ${status}`);
        continue;
      }
      pass(`${route}: status ${status}`);

      await page.waitForTimeout(300);
      const bodyExists = await page.locator("body").count();
      if (bodyExists < 1) {
        fail(`${route}: body not rendered`);
        continue;
      }
      pass(`${route}: body rendered`);

      const overlayText = await page.locator("text=Application error").first().count();
      if (overlayText > 0) {
        fail(`${route}: found Application error overlay`);
      } else {
        pass(`${route}: no Application error overlay`);
      }
    }

    if (pageErrors.length > 0) {
      for (const err of pageErrors) {
        fail(`pageerror: ${err}`);
      }
    } else {
      pass("no pageerror events");
    }
  } finally {
    await context.close();
    await browser.close();
  }

  if (process.exitCode) process.exit(process.exitCode);
  console.log("Admin UI smoke passed");
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
