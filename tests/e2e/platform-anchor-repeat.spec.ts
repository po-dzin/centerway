import { expect, test } from "@playwright/test";

const anchors = [
  { route: "/", hash: "#intro-video" },
  { route: "/programs", hash: "#program-catalog" },
  { route: "/tests", hash: "#tests-available" },
  { route: "/products", hash: "#product-focus" },
];

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test.describe(`repeat platform anchors at ${viewport.width}px`, () => {
    test.use({ viewport });

    for (const { route, hash } of anchors) {
      test(`${route}: repeated click and keyboard activation scroll to the target`, async ({ page }) => {
        await page.goto(route);
        const link = page.locator(`a[href="${hash}"]`);
        const target = page.locator(hash);
        await expect(link).toBeVisible();

        await link.click();
        await expect(page).toHaveURL(new RegExp(`${hash}$`));
        await expect(target).toBeInViewport();

        // Keep the fragment in the URL while returning to the hero manually.
        await page.evaluate(() => window.scrollTo(0, 0));
        await expect(target).not.toBeInViewport();
        await link.click();
        await expect(target).toBeInViewport();

        await page.evaluate(() => window.scrollTo(0, 0));
        await expect(target).not.toBeInViewport();
        await link.focus();
        await link.press("Enter");
        await expect(target).toBeInViewport();
      });
    }
  });
}
