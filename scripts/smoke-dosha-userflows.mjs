import { chromium } from "@playwright/test";

const baseUrl = (process.env.SMOKE_UI_BASE_URL || process.env.SMOKE_BASE_URL || "http://localhost:8000").replace(
  /\/+$/,
  "",
);

const timeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || "20000", 10);
const useMockApi = process.env.SMOKE_DOSHA_MOCK !== "0";

/* THE MOCKS MATCH ON PATHNAME, NOT ON A GLOB (2026-09-11).

   These two routes were globs ending in `api/tests/dosha-test` and the same
   plus `/complete`, and the first one silently stopped matching the day the
   client began sending `?sessionId=` with the definition request: a Playwright
   glob is matched against the WHOLE url, query string included, so the pattern
   missed and every run fell through to the real endpoint instead. On a machine
   without Supabase credentials that endpoint answers 500, the flow never opens
   its first question, and this script fails at "unable to resolve current
   question step" while the UI it is testing is fine.

   Worse, `smoke-dosha-brand-fit.mjs` kept scoring 97% and printing "question
   flow opens without extra blocker" through all of it, because its own probe
   passes before the questions are needed. A mock that can stop matching
   without anything turning red is worse than having no mock at all.

   A predicate on `pathname` cannot drift with the query string, and unlike a
   trailing `**` it cannot accidentally swallow `/complete`. */
const isDoshaDefinitionRoute = (url) => url.pathname === "/api/tests/dosha-test";
const isDoshaCompleteRoute = (url) => url.pathname === "/api/tests/dosha-test/complete";

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
  const option = page.locator("button[data-dosha-option]:enabled").first();
  const count = await option.count();
  if (count < 1) {
    return false;
  }
  await option.click({ timeout: timeoutMs });
  return true;
}

/**
 * Choosing an option does not advance the flow — the step pager does, and it is
 * deliberate: the reader can go back through answered questions. This script
 * used to select an option and then wait for the next question to appear on its
 * own, so every run failed from step 1 onward against a UI that was working.
 * The forward control is «Далі» through step 11 and «Завершити тест» on 12.
 */
async function clickForward(page) {
  const forward = page
    .getByRole("button", { name: /^(Далі|Завершити тест)$/ })
    .first();
  if ((await forward.count()) < 1) return false;
  await forward.click({ timeout: timeoutMs });
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
  /* 390 IS ONLY A WIDTH UNTIL `hasTouch` MAKES IT A PHONE. Without it Chromium
     reports `pointer: fine`, and the design system branches on exactly that —
     the whole `(hover: hover) and (pointer: fine)` block in globals.css hands
     the page its mouse geometry: 40px controls instead of 48px, a tighter
     inline padding, a smaller label. This script walks twelve taps through
     that geometry, so without the flag it was walking the desktop one at a
     phone's width. (`smoke-dosha-brand-fit.mjs` carries the same flag and the
     longer account of what it was measuring wrongly.) */
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
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
          totalQuestions,
          questions: mockQuestions,
        }),
      });
    });
    await page.route(isDoshaCompleteRoute, async (route) => {
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
    // networkidle, not domcontentloaded: on a dev build the intro is painted
    // well before it hydrates, and a click on "Почати тест" before then is lost.
    const response = await page.goto(`${baseUrl}/tests/dosha`, {
      waitUntil: "networkidle",
      timeout: timeoutMs,
    });

    if (!response) {
      fail("/tests/dosha: no response");
      return;
    }

    if (response.status() >= 500) {
      fail(`/tests/dosha: status ${response.status()}`);
      return;
    }
    pass(`/tests/dosha: status ${response.status()}`);

    const introPromiseText = page.getByText("12 питань", { exact: false }).first();
    await introPromiseText.waitFor({ state: "visible", timeout: timeoutMs }).catch(() => undefined);

    await assertVisible(page, "12 питань", "intro promise");
    await assertVisible(page, "Як це працює", "intro how-it-works");
    await assertVisible(page, "Почати тест", "intro primary cta");
    /* The boundary disclosure is a DS collapsible — `details` + `summary` — and
       has been since the intro was rebuilt; the same element opens and closes
       it. `getByRole("button")` cannot match a `summary`, so these steps had
       been timing out against a control that renders correctly. */
    await assertVisible(page, "Що таке доша і межі методу", "intro secondary link");
    const doshaInfoSummary = page.locator("summary", { hasText: "Що таке доша" }).first();
    await doshaInfoSummary.click({ timeout: timeoutMs });
    await assertVisible(page, "не медичний діагноз", "dosha info disclaimer");
    await doshaInfoSummary.click({ timeout: timeoutMs });

    const hasEnglishQuestion = await page.getByText("Question ", { exact: false }).count();
    if (hasEnglishQuestion > 0) {
      fail("intro contains English Question text");
    } else {
      pass("intro has no English question marker");
    }

    await page.getByRole("button", { name: "Почати тест" }).click({ timeout: timeoutMs });
    const questionStep = page.getByText(/Питання\s+\d+\s+з\s+12/i).first();
    const authPromptHeading = page.getByRole("heading", { name: /Увійдіть у профіль/i }).first();
    await Promise.race([
      questionStep.waitFor({ state: "visible", timeout: timeoutMs }).catch(() => undefined),
      authPromptHeading.waitFor({ state: "visible", timeout: timeoutMs }).catch(() => undefined),
    ]);

    const isDeferredAuthPrompt = await authPromptHeading.isVisible().catch(() => false);
    if (isDeferredAuthPrompt) {
      pass("visible: deferred auth prompt heading");
      await assertVisible(page, "Увійти через Google", "deferred auth prompt primary cta");
      if (pageErrors.length > 0) {
        for (const err of pageErrors) {
          fail(`pageerror: ${err}`);
        }
      } else {
        pass("no pageerror events");
      }
      if (process.exitCode) process.exit(process.exitCode);
      console.log("Dosha userflow smoke passed (deferred-auth start)");
      return;
    }

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

      // Step 1 also takes a second mark: two are allowed, the third option waits.
      if (step === 1) {
        await page
          .locator('button[data-dosha-option][aria-pressed="false"]:enabled')
          .first()
          .click({ timeout: timeoutMs });
        const pressed = await page.locator('button[data-dosha-option][aria-pressed="true"]').count();
        const unavailable = await page.locator('button[data-dosha-option][aria-pressed="false"]:disabled').count();
        if (pressed === 2 && unavailable === 1) {
          pass("step 1: two marks taken, third option unavailable");
        } else {
          fail(`step 1: expected 2 marks and 1 unavailable option, got ${pressed} and ${unavailable}`);
        }
      }

      const advanced = await clickForward(page);
      if (!advanced) {
        fail(`step ${step}: no forward control`);
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

    const loadingLocator = page.getByText("Аналізуємо ваш профіль", { exact: false }).first();
    const loadingSeen = await loadingLocator
      .waitFor({ state: "visible", timeout: Math.min(timeoutMs, 3000) })
      .then(() => true)
      .catch(() => false);
    if (loadingSeen) {
      pass("visible: loading screen");
    } else {
      pass("loading screen skipped on fast response");
    }
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
