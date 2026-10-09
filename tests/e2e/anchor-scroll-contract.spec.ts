import { expect, test } from "@playwright/test";

test.use({ baseURL: process.env.SMOKE_UI_BASE_URL || "http://127.0.0.1:8000" });

declare global {
  interface Window {
    __cwAnchorProbe?: {
      startedAt: number | null;
      scrollLatency: number | null;
      maxLongTask: number;
      observesLongTasks: boolean;
    };
  }
}

async function installScrollProbe(page: import("@playwright/test").Page) {
  await page.evaluate(() => {
    const probe = {
      startedAt: null as number | null,
      scrollLatency: null as number | null,
      maxLongTask: 0,
      observesLongTasks:
        "PerformanceObserver" in window && PerformanceObserver.supportedEntryTypes.includes("longtask"),
    };
    window.__cwAnchorProbe = probe;
    document.addEventListener(
      "click",
      (event) => {
        const target = event.target;
        if (!(target instanceof Element) || !target.closest('a[href^="#"], [data-scroll-to]')) return;
        probe.startedAt = performance.now();
        probe.scrollLatency = null;
        probe.maxLongTask = 0;
      },
      true,
    );
    window.addEventListener(
      "scroll",
      () => {
        if (probe.startedAt !== null && probe.scrollLatency === null) {
          probe.scrollLatency = performance.now() - probe.startedAt;
        }
      },
      { passive: true },
    );
    if (probe.observesLongTasks) {
      new PerformanceObserver((entries) => {
        for (const entry of entries.getEntries()) {
          if (probe.startedAt === null || entry.startTime < probe.startedAt) continue;
          const settledAt = probe.startedAt + (probe.scrollLatency ?? Infinity);
          if (entry.startTime > settledAt) continue;
          probe.maxLongTask = Math.max(probe.maxLongTask, entry.duration);
        }
      }).observe({ type: "longtask" });
    }
  });
}

async function expectFirstScrollWithinSurfaceMotion(page: import("@playwright/test").Page) {
  await expect
    .poll(() => page.evaluate(() => window.__cwAnchorProbe?.scrollLatency ?? null), { timeout: 1000 })
    .not.toBeNull();
  const result = await page.evaluate(() => {
    const motion = getComputedStyle(document.documentElement).getPropertyValue("--cw-motion-surface").trim();
    const motionMs = motion.endsWith("ms") ? Number.parseFloat(motion) : Number.parseFloat(motion) * 1000;
    return {
      latency: window.__cwAnchorProbe?.scrollLatency ?? Infinity,
      maxLongTask: window.__cwAnchorProbe?.maxLongTask ?? Infinity,
      observesLongTasks: window.__cwAnchorProbe?.observesLongTasks ?? false,
      motionMs,
    };
  });
  await test.info().attach("anchor-response", {
    body: JSON.stringify(result),
    contentType: "application/json",
  });
  expect(result.latency).toBeLessThanOrEqual(result.motionMs);
  if (result.observesLongTasks) expect(result.maxLongTask).toBeLessThan(result.motionMs);
}

async function expectAtAnchorClearance(target: import("@playwright/test").Locator) {
  await expect
    .poll(async () =>
      target.evaluate((element) => {
        const style = getComputedStyle(element);
        const margin = Number.parseFloat(style.scrollMarginBlockStart || style.scrollMarginTop) || 0;
        const current = window.scrollY;
        const desired = element.getBoundingClientRect().top + current - margin;
        const maximum = document.documentElement.scrollHeight - window.innerHeight;
        return Math.abs(current - Math.max(0, Math.min(maximum, desired)));
      }),
    )
    .toBeLessThan(3);
}

function durationInMilliseconds(value: string) {
  const number = Number.parseFloat(value);
  return value.trim().endsWith("ms") ? number : number * 1000;
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test.describe(`anchor scroll contract at ${viewport.width}px`, () => {
    test.use({ viewport });

    test("platform anchors land at DS clearance and answer within the motion budget", async ({ page }) => {
      await page.goto("/programs");
      await installScrollProbe(page);

      const link = page.locator('a[href="#program-catalog"]');
      const target = page.locator("#program-catalog");
      await expect(link).toBeVisible();
      await link.click();
      await expect(page).toHaveURL(/#program-catalog$/);
      await expect(target).toBeInViewport();
      await expectFirstScrollWithinSurfaceMotion(page);
      await expectAtAnchorClearance(target);

      const geometry = await target.evaluate((element) => {
        const section = getComputedStyle(element);
        const header = document.querySelector<HTMLElement>(
          matchMedia("(max-width: 900px)").matches
            ? '[data-cw-chrome="organs"]'
            : 'header[data-cw-header-autohide="true"]',
        );
        const root = getComputedStyle(document.documentElement);
        const toPixels = (value: string) => {
          const number = Number.parseFloat(value);
          return value.trim().endsWith("rem")
            ? number * Number.parseFloat(root.fontSize)
            : value.trim().endsWith("ms")
              ? number
              : value.trim().endsWith("s")
                ? number * 1000
                : number;
        };
        const headerStyle = header ? getComputedStyle(header) : null;
        const transition = headerStyle ? (headerStyle.transitionDuration.split(",")[0] ?? "0s") : "0s";
        const topbarBlock =
          header && headerStyle ? header.getBoundingClientRect().height + Number.parseFloat(headerStyle.top) : 0;
        return {
          contentTop: element.getBoundingClientRect().top + Number.parseFloat(section.paddingTop),
          topbarBlock,
          step: toPixels(root.getPropertyValue("--cw-space-md")),
          headerTransition: toPixels(transition),
          surfaceMotion: toPixels(root.getPropertyValue("--cw-motion-surface")),
        };
      });
      expect(Math.abs(geometry.contentTop - geometry.topbarBlock - geometry.step)).toBeLessThan(3);
      expect(geometry.headerTransition).toBe(geometry.surfaceMotion);

      // Re-activate the same fragment quickly after returning to the hero.
      for (let index = 0; index < 3; index += 1) {
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
        await expect(link).toBeVisible();
        await link.click();
        await expect(target).toBeInViewport();
        await expectAtAnchorClearance(target);
        await expectFirstScrollWithinSurfaceMotion(page);
      }
    });

    test("managed landing anchors honor CSS clearance and stay responsive", async ({ page }) => {
      await page.goto("/irem");
      await page.evaluate(() => document.fonts.ready);
      await installScrollProbe(page);

      const link = page.locator("[data-cta-hero]").first();
      const target = page.locator("#offer");
      await expect(link).toBeVisible();
      await link.click();
      await expect(page).toHaveURL(/#offer$/);
      await expect(target).toBeInViewport();
      await expectFirstScrollWithinSurfaceMotion(page);
      await expectAtAnchorClearance(target);

      const durations = await page.locator(".cw-nav").evaluate((element) => {
        const surface = getComputedStyle(document.documentElement).getPropertyValue("--cw-motion-surface");
        const nav = getComputedStyle(element).transitionDuration.split(",")[0] ?? "0s";
        return { nav, surface };
      });
      expect(durationInMilliseconds(durations.nav)).toBe(durationInMilliseconds(durations.surface ?? "0s"));

      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await expect(link).toBeVisible();
      await link.click();
      await expect(target).toBeInViewport();
      await expectAtAnchorClearance(target);
      await expectFirstScrollWithinSurfaceMotion(page);
    });

    test("reduced motion removes topbar transitions", async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/programs");
      const platformDuration = await page
        .locator(viewport.width <= 900 ? '[data-cw-chrome="organs"]' : 'header[data-cw-header-autohide="true"]')
        .evaluate((element) => getComputedStyle(element).transitionDuration.split(",")[0] ?? "0s");
      expect(durationInMilliseconds(platformDuration)).toBe(0);

      await page.goto("/irem");
      const landingDuration = await page
        .locator(".cw-nav")
        .evaluate((element) => getComputedStyle(element).transitionDuration.split(",")[0] ?? "0s");
      expect(durationInMilliseconds(landingDuration)).toBe(0);
    });

    test("direct fragment entry and a missing fragment preserve navigation", async ({ page }) => {
      await page.goto("/programs#program-catalog");
      await page.evaluate(() => document.fonts.ready);
      await expectAtAnchorClearance(page.locator("#program-catalog"));
      await page.goto("/irem#nonexistent-section");
      await expect(page.locator("[data-cw-nav]")).toHaveAttribute("data-cw-nav-ready", "1");
      await page.evaluate(() => document.fonts.ready);
      await expect(page.locator("[data-cta-hero]").first()).toBeVisible();
      await page.locator("[data-cta-hero]").first().click();
      await expect(page).toHaveURL(/#offer$/);
      await expectAtAnchorClearance(page.locator("#offer"));
    });

    test("network menu corrects late layout without taking over manual scrolling", async ({ page }) => {
      await page.goto("/dosha/index.html");
      await page.evaluate(() => document.fonts.ready);
      const control = page.locator('.cwn__menu a[href="#faq"]').first();
      const target = page.locator("#faq");
      await page.evaluate(() => {
        document.documentElement.style.overflowAnchor = "none";
        document.body.style.overflowAnchor = "none";
      });
      await control.evaluate((element) => (element as HTMLElement).click());
      await expectAtAnchorClearance(target);
      await target.evaluate((element) => {
        const spacer = document.createElement("div");
        spacer.style.height = "32px";
        element.before(spacer);
      });
      await expectAtAnchorClearance(target);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      await page.waitForTimeout(1400);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(2);
      await expect(page).toHaveURL(/#faq$/);
    });

    test("rapid activation stays responsive under CPU throttling and respects a manual scroll", async ({ page }) => {
      await page.goto("/irem");
      await expect(page.locator("[data-cw-nav]")).toHaveAttribute("data-cw-nav-ready", "1");
      await page.evaluate(() => document.fonts.ready);
      const session = await page.context().newCDPSession(page);
      await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await installScrollProbe(page);
      await page.locator("[data-cta-hero]").first().click();
      await expectFirstScrollWithinSurfaceMotion(page);
      await expectAtAnchorClearance(page.locator("#offer"));
      // Exercise the real handler repeatedly without Playwright's auto-scroll
      // moving the off-screen trigger back into view between clicks.
      const burst = await page
        .locator("[data-cta-hero]")
        .first()
        .evaluate((element) => {
          const started = performance.now();
          for (let index = 0; index < 20; index += 1) (element as HTMLElement).click();
          const token = getComputedStyle(element).getPropertyValue("--cw-motion-surface").trim();
          return {
            elapsed: performance.now() - started,
            budget: Number.parseFloat(token) * (token.endsWith("ms") ? 1 : 1000),
          };
        });
      await test.info().attach("anchor-burst-4x-cpu", {
        body: JSON.stringify(burst),
        contentType: "application/json",
      });
      expect(burst.elapsed).toBeLessThanOrEqual(burst.budget);
      await expectAtAnchorClearance(page.locator("#offer"));
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
      // The runtime retries at 400/1200ms for late font/layout changes. Those
      // retries must never pull somebody back after they deliberately leave.
      await page.waitForTimeout(1400);
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(2);
      await expect(page).toHaveURL(/#offer$/);
      await session.detach();
    });
  });
}
