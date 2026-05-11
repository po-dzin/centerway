import { chromium } from "@playwright/test";

const baseUrl = (
  process.env.SMOKE_UI_BASE_URL ||
  process.env.SMOKE_BASE_URL ||
  "http://localhost:8000"
).replace(/\/+$/, "");

const timeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || "20000", 10);
const landingEntry = (process.env.SMOKE_LANDING_ENTRY || "next").toLowerCase();

const routePathByEntry = {
  next: { short: "/short", irem: "/irem" },
  fallback: { short: "/short", irem: "/irem" },
};

const selectedPaths = routePathByEntry[landingEntry] || routePathByEntry.next;

const routes = [
  { name: "short", path: selectedPaths.short, hasAddons: false },
  { name: "irem", path: selectedPaths.irem, hasAddons: true },
];

const viewports = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 900 },
  { width: 1440, height: 900 },
];

function fail(message) {
  console.log(`FAIL ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`PASS ${message}`);
}

async function assertNoHorizontalOverflow(page, label) {
  const hasOverflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth > 1;
  });
  if (hasOverflow) {
    fail(`${label}: horizontal overflow detected`);
  } else {
    pass(`${label}: no horizontal overflow`);
  }
}

async function assertCoreFlow(page, label) {
  const flow = await page.evaluate(() => {
    const sections = Array.from(document.querySelectorAll("section[data-flow-index][data-section]"));
    return sections.map((section) => ({
      flowIndex: section.getAttribute("data-flow-index"),
      section: section.getAttribute("data-section"),
      className: section.className,
    }));
  });

  if (flow.length !== 9) {
    fail(`${label}: expected 9 core sections, got ${flow.length}`);
    return;
  }

  const expected = [
    { idx: "1", section: "hero", className: "s1" },
    { idx: "2", section: "problem", className: "s2" },
    { idx: "3", section: "solution", className: "s3" },
    { idx: "4", section: "program", className: "s4" },
    { idx: "5", section: "format", className: "s5" },
    { idx: "6", section: "proof", className: "s6" },
    { idx: "7", section: "expert", className: "s7" },
    { idx: "8", section: "offer", className: "s8" },
    { idx: "9", section: "faq", className: "s9" },
  ];

  for (let i = 0; i < expected.length; i += 1) {
    const got = flow[i];
    const exp = expected[i];
    if (
      got.flowIndex !== exp.idx ||
      got.section !== exp.section ||
      !got.className.split(/\s+/).includes(exp.className)
    ) {
      fail(`${label}: flow mismatch at position ${i + 1}`);
      return;
    }
  }

  pass(`${label}: core flow s1..s9 contract`);
}

async function assertDataContract(page, label) {
  const contract = await page.evaluate(() => ({
    topCta: Boolean(document.querySelector("[data-cta-primary]")),
    finalCta: Boolean(document.querySelector("[data-cta-final]")),
    stickyMenu: Boolean(document.querySelector("[data-sticky-menu]")),
  }));

  if (!contract.topCta || !contract.finalCta || !contract.stickyMenu) {
    fail(
      `${label}: missing data contract (top=${contract.topCta}, final=${contract.finalCta}, sticky=${contract.stickyMenu})`
    );
    return;
  }
  pass(`${label}: sticky/cta data contract`);
}

async function assertAddonContract(page, label) {
  const addonCount = await page.locator("section.section-addon-results, section.section-addon-foundations, section.section-addon-protocol, section.section-addon-guarantee").count();
  if (addonCount < 1) {
    fail(`${label}: expected addon sections`);
  } else {
    pass(`${label}: addon sections present (${addonCount})`);
  }
}

async function main() {
  console.log(`Landing short/irem smoke base URL: ${baseUrl}`);
  console.log(`Landing entry mode: ${landingEntry}`);
  const browser = await chromium.launch({ headless: true });

  try {
    for (const route of routes) {
      for (const viewport of viewports) {
        const context = await browser.newContext({ viewport });
        const page = await context.newPage();

        const response = await page.goto(`${baseUrl}${route.path}`, {
          waitUntil: "domcontentloaded",
          timeout: timeoutMs,
        });

        const prefix = `${route.name} @${viewport.width}`;
        if (!response) {
          fail(`${prefix}: no response`);
          await context.close();
          continue;
        }
        if (response.status() >= 500) {
          fail(`${prefix}: status ${response.status()}`);
          await context.close();
          continue;
        }
        pass(`${prefix}: status ${response.status()}`);

        await assertNoHorizontalOverflow(page, prefix);
        await assertCoreFlow(page, prefix);
        await assertDataContract(page, prefix);
        if (route.hasAddons) {
          await assertAddonContract(page, prefix);
        }

        await context.close();
      }
    }
  } finally {
    await browser.close();
  }

  if (process.exitCode) process.exit(process.exitCode);
  console.log("Landing short/irem smoke passed");
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
