import { expect, test, type Locator } from "@playwright/test";

test.use({ baseURL: process.env.SMOKE_UI_BASE_URL || "http://127.0.0.1:8000" });

const anchors = [
  { route: "/", hash: "#intro-video" },
  { route: "/programs", hash: "#program-catalog" },
  { route: "/tests", hash: "#tests-available" },
  { route: "/products", hash: "#product-focus" },
];

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

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test.describe(`repeat platform anchors at ${viewport.width}px`, () => {
    test.use({ viewport });

    for (const { route, hash } of anchors) {
      test(`${route}: repeated click and keyboard activation scroll to the target`, async ({ page }) => {
        await page.goto(route);
        await page.evaluate(() => document.fonts.ready);
        const link = page.locator(`a[href="${hash}"]`);
        const target = page.locator(hash);
        await expect(link).toBeVisible();

        await link.click();
        await expect(page).toHaveURL(new RegExp(`${hash}$`));
        await expect(target).toBeInViewport();
        await expectAtAnchorClearance(target);

        // Keep the fragment in the URL while returning to the hero manually.
        await page.evaluate(() => window.scrollTo(0, 0));
        await expect(target).not.toBeInViewport();
        await link.click();
        await expect(target).toBeInViewport();
        await expectAtAnchorClearance(target);

        await page.evaluate(() => window.scrollTo(0, 0));
        await expect(target).not.toBeInViewport();
        await link.focus();
        await link.press("Enter");
        await expect(target).toBeInViewport();
        await expectAtAnchorClearance(target);
      });
    }
  });
}
