import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

const baseUrl = (process.env.SMOKE_UI_BASE_URL || process.env.SMOKE_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");

async function gotoRoute(page: Page, pathname: string) {
  const response = await page.goto(`${baseUrl}${pathname}`, { waitUntil: "domcontentloaded" });
  expect(response, `${pathname}: missing main document response`).not.toBeNull();
  expect(response!.status(), `${pathname}: unexpected 5xx status`).toBeLessThan(500);
  await expect(page.locator("body")).toBeVisible();
  await expect(page.getByText("Application error").first()).toHaveCount(0);
  return response!;
}

async function readMobileHeaderState(page: Page) {
  return page.evaluate(() => {
    const menuButton = document.querySelector('button[aria-controls="platform-mobile-menu"]') as HTMLButtonElement | null;
    const profileSlot = document.querySelector("header [class*='profileSlot']") as HTMLElement | null;
    const mobileProfileSlot = document.querySelector("header [class*='mobileProfileSlot']") as HTMLElement | null;

    const pick = (node: HTMLElement | null) => {
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      const styles = getComputedStyle(node);
      return {
        display: styles.display,
        visibility: styles.visibility,
        opacity: styles.opacity,
        width: rect.width,
        height: rect.height,
      };
    };

    return {
      menuButton: pick(menuButton),
      profileSlot: pick(profileSlot),
      mobileProfileSlot: pick(mobileProfileSlot),
    };
  });
}

test.describe("platform unification wave 1 smoke", () => {
  test("public platform routes render through canonical shared surfaces", async ({ page }) => {
    await gotoRoute(page, "/");
    await expect(page.locator('main[data-cw-platform-template="home"]')).toBeVisible();

    await gotoRoute(page, "/consult");
    await expect(page.locator('main[data-cw-detail-template="consult"]')).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: /консультац/i })).toBeVisible();

    await gotoRoute(page, "/programs");
    await expect(page.getByRole("heading", { level: 1, name: "Програми CenterWay" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Деталі програми" }).first()).toBeVisible();

    await gotoRoute(page, "/programs/way21");
    await expect(page).toHaveURL(`${baseUrl}/programs/way21`);
    await expect(page.locator('main[data-cw-detail-template="program"]')).toBeVisible();

    await gotoRoute(page, "/products");
    await expect(page.getByRole("heading", { level: 1, name: "Продукти CenterWay" })).toBeVisible();

    await gotoRoute(page, "/products/herbs");
    await expect(page.locator('main[data-cw-detail-template="product"]')).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: /трав/i })).toBeVisible();
  });

  test("canonical aliases redirect to unified platform routes", async ({ page }) => {
    await gotoRoute(page, "/programs/detox");
    await expect(page).toHaveURL(`${baseUrl}/programs/way21`);

    await gotoRoute(page, "/detox");
    await expect(page).toHaveURL(`${baseUrl}/programs/way21`);

    await gotoRoute(page, "/herbs");
    await expect(page).toHaveURL(`${baseUrl}/products/herbs`);
  });

  test("legal and funnel utility surfaces stay on shared templates", async ({ page }) => {
    await gotoRoute(page, "/legal/privacy");
    await expect(page.getByRole("heading", { level: 1, name: "Політика конфіденційності" })).toBeVisible();

    await gotoRoute(page, "/legal/public-offer");
    await expect(page.getByRole("heading", { level: 1, name: "Публічний договір" })).toBeVisible();

    await gotoRoute(page, "/funnel-support/consult/thanks");
    await expect(page.getByRole("heading", { level: 1, name: /дякуємо/i })).toBeVisible();

    await gotoRoute(page, "/funnel-support/detox/public-offer");
    await expect(page.getByRole("heading", { level: 1, name: "Публічний договір" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Повна платформа-версія договору" })).toBeVisible();
  });

  test("generated funnels remain isolated and herbs utility stays closed", async ({ page }) => {
    await gotoRoute(page, "/funnel-entry/consult");
    await expect(page).toHaveURL(`${baseUrl}/funnel-entry/consult`);

    await gotoRoute(page, "/funnel-entry/detox");
    await expect(page).toHaveURL(`${baseUrl}/funnel-entry/detox`);

    const response = await page.goto(`${baseUrl}/funnel-support/herbs/thanks`, { waitUntil: "domcontentloaded" });
    expect(response, "/funnel-support/herbs/thanks: missing main document response").not.toBeNull();
    expect(response!.status(), "/funnel-support/herbs/thanks: herbs utility must stay closed").toBe(404);
  });

  test("mobile home stays within viewport without horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 446, height: 1114 });
    await gotoRoute(page, "/");

    const overflow = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
    }));

    expect(overflow.scrollWidth, `mobile home overflow: scrollWidth=${overflow.scrollWidth}, viewport=${overflow.viewportWidth}`).toBeLessThanOrEqual(overflow.viewportWidth);
    expect(overflow.bodyScrollWidth, `mobile home body overflow: bodyScrollWidth=${overflow.bodyScrollWidth}, viewport=${overflow.viewportWidth}`).toBeLessThanOrEqual(overflow.viewportWidth);
  });

  test("mobile shell keeps burger in topbar and profile inside overlay", async ({ page }) => {
    await page.setViewportSize({ width: 430, height: 932 });

    for (const pathname of ["/", "/consult"]) {
      await gotoRoute(page, pathname);

      const closedState = await readMobileHeaderState(page);
      expect(closedState.menuButton?.display, `${pathname}: mobile burger must be visible in topbar`).toBe("grid");
      expect(closedState.profileSlot?.display, `${pathname}: compact profile must stay out of mobile topbar`).toBe("none");
      expect(closedState.mobileProfileSlot, `${pathname}: mobile profile slot should exist in overlay contract`).not.toBeNull();
    }

    await gotoRoute(page, "/consult");
    await page.getByRole("button", { name: "Відкрити меню" }).click();
    await expect(page.getByRole("button", { name: "Закрити меню" })).toBeVisible();
    await expect(page.locator('#platform-mobile-menu a[aria-label="Профіль"]')).toBeVisible();

    await page.getByRole("button", { name: "Закрити меню" }).click();
    await expect(page.getByRole("button", { name: "Відкрити меню" })).toBeVisible();
  });
});
