import type { Locator, Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

test.use({ baseURL: process.env.SMOKE_UI_BASE_URL || "http://127.0.0.1:8000" });

const landings = [
  { route: "/reboot", hero: "[data-cta-primary][data-scroll-to]", target: "offer" },
  { route: "/reboot-b", hero: "[data-cta-hero]", target: "offer" },
  { route: "/irem", hero: "[data-cta-hero]", target: "offer" },
  { route: "/way21", hero: "[data-cta-hero]", target: "offer" },
  { route: "/reset-day", hero: "[data-cta-hero]", target: "offer" },
  { route: "/consult/index.html", hero: "[data-cta-hero]", target: "lead" },
  // Herbs may have a paid CTA; test its page navigation without starting checkout.
  { route: "/herbs", hero: null, target: null },
  { route: "/dosha/index.html", hero: null, target: null },
];

async function returnToTop(page: Page, navigation = false) {
  await page.evaluate((nav) => {
    const hero = document.querySelector('.hero, [data-section="hero"]');
    const heroBottom = hero ? hero.getBoundingClientRect().bottom + window.scrollY : window.innerHeight;
    window.scrollTo({ top: nav ? heroBottom + 100 : 0, behavior: "instant" });
  }, navigation);
  if (navigation) {
    // Chrome returns on an upward scroll gesture after tucking on the way down.
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    );
    await page.evaluate(() => window.scrollBy({ top: -60, behavior: "instant" }));
  }
  if (!navigation) await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(30);
}

async function expectAtAnchorClearance(target: Locator) {
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

async function repeatActivation(page: Page, control: Locator, target: Locator, open?: () => Promise<void>) {
  for (const keyboard of [false, false, true]) {
    await returnToTop(page, !!open);
    await expect(target).not.toBeInViewport();
    if (open) await open();
    await expect(control).toBeVisible();
    if (keyboard) {
      await control.focus();
      await control.press("Enter");
    } else {
      await control.click();
    }
    await expect(target).toBeInViewport();
    await expectAtAnchorClearance(target);
  }
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test.describe(`landing anchors at ${viewport.width}px`, () => {
    test.describe.configure({ mode: "parallel" });
    test.use({ viewport });
    for (const { route, hero, target } of landings) {
      test(`${route}: repeat CTA and page navigation`, async ({ page }) => {
        await page.goto(route);
        if (await page.locator("[data-cw-nav]").count()) {
          await expect(page.locator("[data-cw-nav]")).toHaveAttribute("data-cw-nav-ready", "1");
        }
        await page.evaluate(() => document.fonts.ready);
        // Preserve the existing fragment on every activation, including handlers
        // that scroll without writing a fragment themselves.
        if (hero && target) {
          await page.evaluate((id) => history.replaceState(null, "", `#${id}`), target);
          await page.waitForTimeout(500);
          await repeatActivation(page, page.locator(hero).first(), page.locator(`#${target}`));
        }

        await page.evaluate(() => history.replaceState(null, "", "#faq"));
        const control = page
          .locator(
            '[data-cw-nav-panel] a[href="#faq"]:visible, .cw-nav__desktop a[href="#faq"]:visible, .cwn__menu a[href="#faq"]:visible',
          )
          .first();
        const toggle = page.locator("[data-cw-nav-toggle], .cwn__toggle").first();
        const open = async () => {
          if (await toggle.isVisible()) {
            await toggle.click();
          }
        };
        await repeatActivation(page, control, page.locator("#faq"), open);
        await expect(page).toHaveURL(/#faq$/);
      });
    }
  });
}
