import { chromium } from "@playwright/test";

const baseUrl = (process.env.SMOKE_UI_BASE_URL || process.env.SMOKE_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");
const timeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || "20000", 10);
const useMockApi = process.env.SMOKE_DOSHA_MOCK !== "0";

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

async function assertNoHorizontalOverflow(page, label) {
  const overflow = await page.evaluate(() => {
    const html = document.documentElement;
    return html.scrollWidth - html.clientWidth;
  });
  if (overflow > 1) {
    fail(`${label}: horizontal overflow ${overflow}px`);
  } else {
    pass(`${label}: no horizontal overflow`);
  }
}

async function main() {
  console.log(`Dosha responsive smoke base URL: ${baseUrl}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  if (useMockApi) {
    await page.route("**/api/platform/users/sync", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    await page.route("**/api/tests/dosha-test", async (route) => {
      if (route.request().method() !== "GET") {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          testId: "mock-test-1",
          testVersion: "v1",
          totalQuestions: 12,
          questions: [
            {
              id: "q-1",
              orderIndex: 1,
              code: "q01",
              text: "Тестове питання 1",
              options: [
                { id: "q-1-a1", order: 1, code: "q01_a1", text: "Варіант 1", mappedDosha: "vata" },
                { id: "q-1-a2", order: 2, code: "q01_a2", text: "Варіант 2", mappedDosha: "pitta" },
                { id: "q-1-a3", order: 3, code: "q01_a3", text: "Варіант 3", mappedDosha: "kapha" },
              ],
            },
          ],
        }),
      });
    });
    await page.route("**/api/tests/dosha-test/complete", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          isCompleted: true,
          attemptId: `mock-attempt-${Date.now()}`,
          resultType: "vata",
          scores: { vata: 1, pitta: 0, kapha: 0 },
          completedAt: new Date().toISOString(),
          nextStep: "consultation",
        }),
      });
    });
  }

  const pageErrors = [];
  page.on("pageerror", (error) => {
    pageErrors.push(String(error?.message || error));
  });

  try {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);

      const response = await page.goto(`${baseUrl}/dosha-test`, {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs,
      });

      if (!response) {
        fail(`/dosha-test @${viewport.width}: no response`);
        continue;
      }

      if (response.status() >= 500) {
        fail(`/dosha-test @${viewport.width}: status ${response.status()}`);
        continue;
      }
      pass(`/dosha-test @${viewport.width}: status ${response.status()}`);

      const hasMain = await page.locator("main").count();
      if (hasMain < 1) {
        fail(`/dosha-test @${viewport.width}: missing <main>`);
      } else {
        pass(`/dosha-test @${viewport.width}: main present`);
      }

      await assertNoHorizontalOverflow(page, `/dosha-test intro @${viewport.width}`);

      // Question flow is covered by dedicated userflow smoke; responsive gate focuses on layout stability.
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
  console.log("Dosha responsive smoke passed");
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
