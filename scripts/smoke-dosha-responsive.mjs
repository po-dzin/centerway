import { chromium } from "@playwright/test";

const baseUrl = (process.env.SMOKE_UI_BASE_URL || process.env.SMOKE_BASE_URL || "http://localhost:8000").replace(
  /\/+$/,
  "",
);
const timeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || "20000", 10);
const useMockApi = process.env.SMOKE_DOSHA_MOCK !== "0";

/* Pathname predicates, not globs: a Playwright glob is matched against the
   whole url, so a pattern ending in `api/tests/dosha-test` stopped matching
   the moment the client added `?sessionId=`, and every run fell through to the
   real endpoint. The full account is in scripts/smoke-dosha-userflows.mjs. */
const isDoshaDefinitionRoute = (url) => url.pathname === "/api/tests/dosha-test";
const isDoshaCompleteRoute = (url) => url.pathname === "/api/tests/dosha-test/complete";

/* TOUCH BELONGS TO THE PHONE, NOT TO THE MATRIX (2026-09-11).

   The design system branches on the POINTER, not on the width: the
   `(hover: hover) and (pointer: fine)` block in globals.css hands a page the
   mouse geometry — 40px controls instead of 48, tighter inline padding — and
   Chromium reports a fine pointer unless the context is built with `hasTouch`.
   A matrix that ran every width without it measured desktop geometry at 375,
   which is the one width where that is certainly wrong.

   Flagged per viewport rather than globally, because `hasTouch` on 1440 would
   be the same lie in the other direction. The line falls after 768: that width
   is the product's tablet band (docs/design-system.md → the 561–900 strip),
   and a tablet is a finger device — so the two widths a hand actually holds
   report coarse, and the two a mouse drives report fine. */
const viewports = [
  { width: 375, height: 812, touch: true },
  { width: 768, height: 900, touch: true },
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

/* One page per viewport now, so the mocks are installed per page instead of
   once on a shared one. */
async function installMocks(page) {
  if (!useMockApi) return;
  await page.route("**/api/platform/users/sync", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.route(isDoshaDefinitionRoute, async (route) => {
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
  await page.route(isDoshaCompleteRoute, async (route) => {
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

async function main() {
  console.log(`Dosha responsive smoke base URL: ${baseUrl}`);

  const browser = await chromium.launch({ headless: true });
  const pageErrors = [];

  try {
    for (const viewport of viewports) {
      /* A CONTEXT PER WIDTH, because `hasTouch` is a context option and cannot
         be changed on a page the way `setViewportSize` can. The matrix used to
         resize one page, which is why every width inherited the pointer of the
         first one. */
      const { touch = false, ...size } = viewport;
      const context = await browser.newContext({ viewport: size, hasTouch: touch });
      const page = await context.newPage();
      page.on("pageerror", (error) => {
        pageErrors.push(String(error?.message || error));
      });
      await installMocks(page);

      const response = await page.goto(`${baseUrl}/tests/dosha`, {
        waitUntil: "domcontentloaded",
        timeout: timeoutMs,
      });

      if (!response) {
        fail(`/tests/dosha @${viewport.width}: no response`);
        await context.close();
        continue;
      }

      if (response.status() >= 500) {
        fail(`/tests/dosha @${viewport.width}: status ${response.status()}`);
        await context.close();
        continue;
      }
      pass(`/tests/dosha @${viewport.width}: status ${response.status()}`);

      const hasMain = await page.locator("main").count();
      if (hasMain < 1) {
        fail(`/tests/dosha @${viewport.width}: missing <main>`);
      } else {
        pass(`/tests/dosha @${viewport.width}: main present`);
      }

      await assertNoHorizontalOverflow(page, `/tests/dosha intro @${viewport.width}`);

      // Question flow is covered by dedicated userflow smoke; responsive gate focuses on layout stability.
      await context.close();
    }

    if (pageErrors.length > 0) {
      for (const err of pageErrors) {
        fail(`pageerror: ${err}`);
      }
    } else {
      pass("no pageerror events across responsive matrix");
    }
  } finally {
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
