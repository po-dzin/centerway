import { chromium } from "@playwright/test";

const baseUrl = (
  process.env.SMOKE_UI_BASE_URL ||
  process.env.SMOKE_BASE_URL ||
  "http://localhost:8000"
).replace(/\/+$/, "");

const timeoutMs = Number.parseInt(process.env.SMOKE_TIMEOUT_MS || "20000", 10);
const landingEntry = (process.env.SMOKE_LANDING_ENTRY || "next").toLowerCase();

const routePathByEntry = {
  next: { short: "/reboot", irem: "/irem" },
  fallback: { short: "/reboot", irem: "/irem" },
};

const selectedPaths = routePathByEntry[landingEntry] || routePathByEntry.next;

const routes = [
  { name: "short", path: selectedPaths.short, contract: "short" },
  { name: "irem", path: selectedPaths.irem, contract: "irem" },
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

async function assertShortCoreFlow(page, label) {
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

async function assertShortDataContract(page, label) {
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

async function assertIremEntryContract(page, label) {
  const contract = await page.evaluate(() => ({
    sectionCount: document.querySelectorAll("section").length,
    hero: Boolean(document.querySelector('main[data-cw-landing="irem"][data-cw-page="irem"] .hero')),
    offer: Boolean(document.querySelector("section#offer")),
    heroPrice: Boolean(document.querySelector(".hero-price")),
    formatPrice: Boolean(document.querySelector(".format-card.self .fc-price")),
    heroCta: Boolean(document.querySelector("[data-cta-hero]")),
    finalCheckoutCta: Boolean(document.querySelector(".openModal[data-cta-final]")),
    stickyCta: Boolean(document.querySelector(".sticky-cta")),
    shortEntryBridge: Boolean(document.querySelector(".short-block")),
    faqCount: document.querySelectorAll(".faq details").length,
    legacyRef: document.documentElement.innerHTML.includes("/irem-v2"),
  }));

  if (contract.sectionCount < 12) {
    fail(`${label}: expected promoted section stack, got ${contract.sectionCount} sections`);
    return;
  }

  if (
    !contract.hero ||
    !contract.offer ||
    !contract.heroPrice ||
    !contract.formatPrice ||
    !contract.heroCta ||
    !contract.finalCheckoutCta ||
    !contract.stickyCta ||
    !contract.shortEntryBridge
  ) {
    fail(
      `${label}: missing promoted contract (hero=${contract.hero}, offer=${contract.offer}, heroPrice=${contract.heroPrice}, formatPrice=${contract.formatPrice}, heroCta=${contract.heroCta}, finalCheckout=${contract.finalCheckoutCta}, sticky=${contract.stickyCta}, shortBridge=${contract.shortEntryBridge})`
    );
    return;
  }

  if (contract.faqCount < 5) {
    fail(`${label}: expected faq contract, got ${contract.faqCount} items`);
    return;
  }

  if (contract.legacyRef) {
    fail(`${label}: found legacy /irem-v2 reference in rendered html`);
    return;
  }

  pass(`${label}: promoted IREM entry contract`);
}

async function assertIremCheckoutRedirect(page, label) {
  let payStartUrl = "";

  await page.route("**/api/pay/start**", async (route) => {
    payStartUrl = route.request().url();
    await route.fulfill({
      status: 200,
      contentType: "text/plain; charset=utf-8",
      body: "ok",
    });
  });

  await page.waitForFunction(() => typeof window.CW_trackLead === "function");
  await page.locator(".openModal[data-cta-final]").first().scrollIntoViewIfNeeded();
  await page.locator(".openModal[data-cta-final]").first().evaluate((node) => {
    node.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(200);

  if (!payStartUrl) {
    fail(`${label}: checkout CTA did not request /api/pay/start`);
    return;
  }

  const parsed = new URL(payStartUrl);
  if (parsed.pathname !== "/api/pay/start" || parsed.searchParams.get("product") !== "irem") {
    fail(`${label}: checkout CTA requested unexpected URL ${payStartUrl}`);
    return;
  }

  pass(`${label}: checkout CTA hits /api/pay/start for IREM`);
}

async function assertRouteStatus(browser, label, path, expectedStatus, verify) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  try {
    const response = await page.goto(`${baseUrl}${path}`, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });

    if (!response) {
      fail(`${label}: no response`);
      return;
    }

    if (response.status() !== expectedStatus) {
      fail(`${label}: expected status ${expectedStatus}, got ${response.status()}`);
      return;
    }

    if (verify) {
      const message = await verify(page);
      if (message) {
        fail(`${label}: ${message}`);
        return;
      }
    }

    pass(`${label}: status ${expectedStatus}`);
  } finally {
    await context.close();
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
        if (route.contract === "short") {
          await assertShortCoreFlow(page, prefix);
          await assertShortDataContract(page, prefix);
        } else {
          await assertIremEntryContract(page, prefix);
          await assertIremCheckoutRedirect(page, prefix);
        }

        await context.close();
      }
    }

    await assertRouteStatus(browser, "irem-v2 removal", "/irem-v2", 404);
    await assertRouteStatus(browser, "irem thanks", "/irem/thanks", 200, async (page) => {
      const ok = await page.evaluate(() => {
        return Boolean(document.querySelector('link[href="/irem/css/irem.theme.css"]')) &&
          Boolean(document.querySelector(".utility-status-card"));
      });
      return ok ? "" : "missing themed thanks utility contract";
    });
    await assertRouteStatus(browser, "irem pay-failed", "/irem/pay-failed", 200, async (page) => {
      const ok = await page.evaluate(() => {
        return Boolean(document.querySelector('link[href="/irem/css/irem.theme.css"]')) &&
          Boolean(document.querySelector(".utility-status-card"));
      });
      return ok ? "" : "missing themed pay-failed utility contract";
    });
    await assertRouteStatus(browser, "irem public-offer", "/irem/public-offer.html", 200, async (page) => {
      const ok = await page.evaluate(() => {
        return Boolean(document.querySelector('link[href="/irem/css/irem.theme.css"]')) &&
          Boolean(document.querySelector(".public-offer-page")) &&
          Boolean(document.querySelector(".public-offer"));
      });
      return ok ? "" : "missing themed public-offer contract";
    });
    await assertRouteStatus(browser, "irem index2", "/irem/index2.html", 200, async (page) => {
      const ok = await page.evaluate(() => {
        return document.documentElement.getAttribute("data-cw-page") === "index2" &&
          Boolean(document.querySelector('script[src="/shared/js/landing-runtime.js"]')) &&
          Boolean(document.querySelector('link[href="css/irem.theme.css"], link[href="/irem/css/irem.theme.css"]')) &&
          Boolean(document.querySelector(".public-offer-page")) &&
          Boolean(document.querySelector(".cw-legal"));
      });
      return ok ? "" : "missing managed index2 contract";
    });
    await assertRouteStatus(browser, "reboot index2", "/reboot/index2.html", 200, async (page) => {
      const ok = await page.evaluate(() => {
        return document.documentElement.getAttribute("data-cw-page") === "index2" &&
          Boolean(document.querySelector('script[src="/shared/js/landing-runtime.js"]')) &&
          Boolean(document.querySelector('link[href="/shared/css/landing.bridge.css"]')) &&
          Boolean(document.querySelector(".public-offer-page, body > h1")) &&
          !document.documentElement.innerHTML.includes("/irem/css/irem.theme.css");
      });
      return ok ? "" : "missing managed reboot index2 contract";
    });
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
