import { readFile } from "node:fs/promises";
import { chromium } from "@playwright/test";

const baseUrl = (process.env.SMOKE_UI_BASE_URL || process.env.SMOKE_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");
const timeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || "20000", 10);
const useMockApi = process.env.SMOKE_DOSHA_MOCK !== "0";

const componentPath = "src/components/dosha-test/DoshaTestClient.tsx";
const contractPath = "docs/dosha_test_ui_contract_v1.md";
const specPath = "docs/center_way_dosha_test_spec_agent_ready.md";

const score = {
  total: 0,
  max: 100,
  sections: [],
};

function addSection(name, points, maxPoints, details) {
  score.total += points;
  score.sections.push({ name, points, maxPoints, details });
}

async function checkStaticContract() {
  const [component, contract, spec] = await Promise.all([
    readFile(componentPath, "utf8"),
    readFile(contractPath, "utf8"),
    readFile(specPath, "utf8"),
  ]);

  let points = 0;
  const details = [];

  const cwTokenHits = (component.match(/var\(--cw-/g) || []).length;
  if (cwTokenHits >= 25) {
    points += 10;
    details.push(`cw tokens: ${cwTokenHits} (>=25)`);
  } else {
    details.push(`cw tokens: ${cwTokenHits} (<25)`);
  }

  const motionReduceHits = (component.match(/motion-reduce:/g) || []).length;
  if (motionReduceHits >= 3) {
    points += 5;
    details.push(`motion-reduce hits: ${motionReduceHits}`);
  } else {
    details.push(`motion-reduce hits low: ${motionReduceHits}`);
  }

  const focusVisibleHits = (component.match(/focus-visible:/g) || []).length;
  if (focusVisibleHits >= 3) {
    points += 5;
    details.push(`focus-visible hits: ${focusVisibleHits}`);
  } else {
    details.push(`focus-visible hits low: ${focusVisibleHits}`);
  }

  const hasContractLinkInSpec = spec.includes("dosha_test_ui_contract_v1.md");
  if (hasContractLinkInSpec) {
    points += 5;
    details.push("spec linked to UI contract");
  } else {
    details.push("spec missing UI contract link");
  }

  const hasMandatoryRules = contract.includes("UA-first") && contract.includes("One primary CTA per screen") && contract.includes("reduced-motion");
  if (hasMandatoryRules) {
    points += 5;
    details.push("contract mandatory rules present");
  } else {
    details.push("contract missing mandatory rules");
  }

  const requiredCopyMarkers = [
    "Питання {currentQuestion.orderIndex} з {totalQuestions}",
    "Прогрес {progress}%",
    "Ваш профіль",
    "Що це означає у практиці",
    "Наступний крок",
    "wellness-орієнтир",
  ];
  const copyHits = requiredCopyMarkers.filter((phrase) => component.includes(phrase)).length;
  const copyPoints = Math.round((copyHits / requiredCopyMarkers.length) * 20);
  points += copyPoints;
  details.push(`route/trust copy markers: ${copyHits}/${requiredCopyMarkers.length} -> ${copyPoints}/20`);

  const ctaMarkers = [
    "Почати тест",
    "Отримати персональні рекомендації",
    "Переглянути програму",
    "Пройти тест ще раз",
  ];
  const ctaHits = ctaMarkers.filter((phrase) => component.includes(phrase)).length;
  const ctaPoints = Math.round((ctaHits / ctaMarkers.length) * 10);
  points += ctaPoints;
  details.push(`CTA markers: ${ctaHits}/${ctaMarkers.length} -> ${ctaPoints}/10`);

  addSection("Static brand contract", points, 60, details);
}

async function checkRuntimeSemantics() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  let points = 0;
  const details = [];

  try {
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
      await page.route("**/api/test-attempts/**/events", async (route) => {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
      });
    }

    const response = await page.goto(`${baseUrl}/dosha-test`, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });

    if (!response || response.status() >= 500) {
      details.push(`route not healthy: status=${response?.status() ?? "no-response"}`);
      addSection("Runtime semio/ux signals", points, 70, details);
      return;
    }

    const introChecks = [
      "12 питань",
      "Як це працює",
      "Почати тест",
      "Що таке доша?",
    ];

    let introPass = 0;
    for (const phrase of introChecks) {
      const found = (await page.getByText(phrase, { exact: false }).count()) > 0;
      if (found) introPass += 1;
    }
    const introPoints = Math.round((introPass / introChecks.length) * 20);
    points += introPoints;
    details.push(`intro contract: ${introPass}/${introChecks.length} -> ${introPoints}/20`);

    const englishHits =
      (await page.getByText("Question ", { exact: false }).count()) +
      (await page.getByText("Next step", { exact: false }).count()) +
      (await page.getByText("Loading", { exact: false }).count());
    if (englishHits === 0) {
      points += 10;
      details.push("UA-first runtime copy: pass");
    } else {
      details.push(`UA-first runtime copy: fail (${englishHits} EN marker hits)`);
    }

    await page.getByRole("button", { name: "Що таке доша?" }).click({ timeout: timeoutMs });
    const hasDisclosureDisclaimer = (await page.getByText("не є медичним діагнозом", { exact: false }).count()) > 0;
    if (hasDisclosureDisclaimer) {
      points += 10;
      details.push("dosha disclosure disclaimer: pass");
    } else {
      details.push("dosha disclosure disclaimer: missing");
    }

    const targetHeights = await page.evaluate(() => {
      const start = Array.from(document.querySelectorAll("button")).find(
        (node) => node.textContent?.trim() === "Почати тест"
      );
      return {
        startHeight: start ? Math.round(start.getBoundingClientRect().height) : 0,
      };
    });

    if (targetHeights.startHeight >= 44) {
      points += 10;
      details.push(`touch target: start=${targetHeights.startHeight}px`);
    } else {
      details.push(`touch target below threshold: start=${targetHeights.startHeight}px`);
    }

    if (points > 40) points = 40;
  } finally {
    await context.close();
    await browser.close();
  }

  addSection("Runtime semio/ux signals", points, 40, details);
}

async function main() {
  console.log(`Dosha brand-fit smoke base URL: ${baseUrl}`);

  await checkStaticContract();
  await checkRuntimeSemantics();

  console.log("Brand-fit score breakdown:");
  for (const section of score.sections) {
    console.log(`- ${section.name}: ${section.points}/${section.maxPoints}`);
    for (const detail of section.details) {
      console.log(`  • ${detail}`);
    }
  }

  const finalScore = Math.round((score.total / score.max) * 100);
  console.log(`Final brand-fit score: ${finalScore}%`);

  if (finalScore < 90) {
    console.log("FAIL brand-fit threshold is 90%");
    process.exit(1);
  }

  console.log("PASS brand-fit threshold >= 90%");
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
