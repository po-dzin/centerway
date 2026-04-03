import { chromium } from "@playwright/test";

const baseUrl = (
  process.env.SMOKE_UI_BASE_URL ||
  process.env.SMOKE_BASE_URL ||
  "http://localhost:8000"
).replace(/\/+$/, "");

const timeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || "20000", 10);
const useMockApi = process.env.SMOKE_DOSHA_MOCK !== "0";

function fail(message) {
  console.log(`FAIL ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`PASS ${message}`);
}

async function assertVisible(page, text, label) {
  const locator = page.getByText(text, { exact: false }).first();
  try {
    await locator.waitFor({ state: "visible", timeout: timeoutMs });
    pass(`visible: ${label}`);
    return true;
  } catch {
    fail(`missing text: ${label}`);
    return false;
  }
}

async function clickFirstEnabledOption(page) {
  const option = page.locator("button.w-full:enabled").first();
  const count = await option.count();
  if (count < 1) {
    return false;
  }
  await option.click({ timeout: timeoutMs });
  return true;
}

async function readCurrentStep(page) {
  const progressLabel = page.getByText(/Питання\s+\d+\s+з\s+12/i).first();
  const count = await progressLabel.count();
  if (count < 1) return null;
  const raw = (await progressLabel.textContent()) || "";
  const match = raw.match(/Питання\s+(\d+)\s+з\s+12/i);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

async function main() {
  console.log(`Dosha userflow smoke base URL: ${baseUrl}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => {
    window.localStorage.removeItem("centerway_dosha_test_attempt_id");
    window.localStorage.removeItem("centerway_dosha_test_draft_v1");
    window.localStorage.removeItem("centerway_dosha_test_session_id");
  });
  const page = await context.newPage();

  if (useMockApi) {
    let activeAttemptId = "mock-attempt-1";
    const totalQuestions = 12;
    const mockQuestions = Array.from({ length: totalQuestions }, (_, idx) => {
      const qIdx = idx + 1;
      return {
        id: `q-${qIdx}`,
        orderIndex: qIdx,
        code: `q${String(qIdx).padStart(2, "0")}`,
        text: `Тестове питання ${qIdx}`,
        options: [
          { id: `q-${qIdx}-a1`, order: 1, code: `q${qIdx}_a1`, text: "Варіант 1", mappedDosha: "vata" },
          { id: `q-${qIdx}-a2`, order: 2, code: `q${qIdx}_a2`, text: "Варіант 2", mappedDosha: "pitta" },
          { id: `q-${qIdx}-a3`, order: 3, code: `q${qIdx}_a3`, text: "Варіант 3", mappedDosha: "kapha" },
        ],
      };
    });

    await page.route("**/api/platform/users/sync", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
    });
    await page.route("**/api/test-attempts/**/events", async (route) => {
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
          totalQuestions,
          questions: mockQuestions,
        }),
      });
    });
    await page.route("**/api/tests/dosha-test/complete", async (route) => {
      activeAttemptId = `mock-attempt-${Date.now()}`;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          attemptId: activeAttemptId,
          isCompleted: true,
          resultType: "vata",
          scores: { vata: totalQuestions, pitta: 0, kapha: 0 },
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
    const response = await page.goto(`${baseUrl}/dosha-test`, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });

    if (!response) {
      fail("/dosha-test: no response");
      return;
    }

    if (response.status() >= 500) {
      fail(`/dosha-test: status ${response.status()}`);
      return;
    }
    pass(`/dosha-test: status ${response.status()}`);

    await assertVisible(page, "12 питань", "intro promise");
    await assertVisible(page, "Як це працює", "intro how-it-works");
    await assertVisible(page, "Почати тест", "intro primary cta");
    await assertVisible(page, "Що таке доша?", "intro secondary link");
    await page.getByRole("button", { name: "Що таке доша?" }).click({ timeout: timeoutMs });
    await assertVisible(page, "не є медичним діагнозом", "dosha info disclaimer");
    await page.getByRole("button", { name: "Сховати опис доші" }).click({ timeout: timeoutMs });

    const hasEnglishQuestion = await page.getByText("Question ", { exact: false }).count();
    if (hasEnglishQuestion > 0) {
      fail("intro contains English Question text");
    } else {
      pass("intro has no English question marker");
    }

    await page.getByRole("button", { name: "Почати тест" }).click({ timeout: timeoutMs });
    await page.getByText(/Питання\s+\d+\s+з\s+12/i).first().waitFor({ state: "visible", timeout: timeoutMs });

    let step = await readCurrentStep(page);
    if (!step) {
      fail("unable to resolve current question step");
      return;
    }

    while (step <= 12) {
      await assertVisible(page, `Питання ${step} з 12`, `question step ${step}`);
      await assertVisible(page, "Прогрес", `progress label at step ${step}`);

      const clicked = await clickFirstEnabledOption(page);
      if (!clicked) {
        fail(`step ${step}: no enabled option`);
        break;
      }

      if (step < 12) {
        await page
          .getByText(`Питання ${step + 1} з 12`, { exact: false })
          .first()
          .waitFor({ state: "visible", timeout: timeoutMs })
          .catch(() => fail(`step ${step}: next question did not render`));
      }

      if (step === 12) break;
      const next = await readCurrentStep(page);
      if (!next || next <= step) {
        fail(`step ${step}: invalid next step`);
        break;
      }
      step = next;
    }

    await assertVisible(page, "Аналізуємо ваш профіль", "loading screen");
    await assertVisible(page, "Ваш профіль", "result header");
    await assertVisible(page, "Що це означає у практиці", "result practice block");
    await assertVisible(page, "Наступний крок", "result route block");
    await assertVisible(page, "Отримати персональні рекомендації", "result primary cta");
    await assertVisible(page, "Переглянути програму", "result secondary cta");
    await assertVisible(page, "Пройти тест ще раз", "result retake cta");

    await page.getByRole("button", { name: "Пройти тест ще раз" }).click({ timeout: timeoutMs });
    await assertVisible(page, "Почати тест", "retake goes to intro");

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
  console.log("Dosha userflow smoke passed");
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
