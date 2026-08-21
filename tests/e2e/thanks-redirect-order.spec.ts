import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    CW_purchaseRedirectGate?: unknown;
  }
}

const baseUrl = (process.env.SMOKE_UI_BASE_URL || "http://127.0.2.2:8002").replace(/\/+$/, "");

// Both funnels now hand the buyer to the platform cabinet, not to Telegram:
// the course itself lives in /learn, and Telegram is only the support fallback.
const thanksCases = [
  {
    name: "way21",
    path: "/way21/thanks?product=way21&order_ref=smoke-way21&payment_id=rrn-way21&amount=4100&currency=UAH",
    pageAttr: "thanks",
    cabinetHref: "https://centerway.net.ua/learn/way21",
  },
  {
    name: "reset-day",
    path: "/reset-day/thanks?product=reset-day&order_ref=smoke-reset&payment_id=rrn-reset&amount=795&currency=UAH",
    pageAttr: "thanks",
    cabinetHref: "https://centerway.net.ua/learn/reset-day",
  },
] as const;

test.describe("thanks redirect order smoke", () => {
  for (const thankCase of thanksCases) {
    test(`${thankCase.name}: client signal starts before cabinet redirect`, async ({ page }) => {
      const events: Array<{ type: "signal" | "redirect"; url: string; method: string; ts: number }> = [];

      page.on("request", (request) => {
        const url = request.url();
        if (url.includes("/api/events")) {
          events.push({ type: "signal", url, method: request.method(), ts: Date.now() });
        }
        if (url.startsWith(thankCase.cabinetHref)) {
          events.push({ type: "redirect", url, method: request.method(), ts: Date.now() });
        }
      });

      const response = await page.goto(`${baseUrl}${thankCase.path}`, { waitUntil: "domcontentloaded" });
      expect(response, `${thankCase.name}: missing main document response`).not.toBeNull();
      expect(response!.status(), `${thankCase.name}: thanks page must open successfully`).toBe(200);

      await expect(page.locator(`html[data-cw-page="${thankCase.pageAttr}"]`)).toBeVisible();
      const cabinetButton = page.getByRole("link", { name: "Увійти в кабінет" });
      await expect(cabinetButton).toBeVisible();
      await expect(cabinetButton).toHaveAttribute("href", thankCase.cabinetHref);

      await page.waitForFunction(() => typeof window.CW_purchaseRedirectGate !== "undefined");
      await page.waitForTimeout(4600);

      const signal = events.find((entry) => entry.type === "signal" && entry.method === "POST");
      const redirect = events.find((entry) => entry.type === "redirect");

      expect(signal, `${thankCase.name}: /api/events request must start`).toBeTruthy();
      expect(redirect, `${thankCase.name}: cabinet redirect must start`).toBeTruthy();
      expect(signal!.ts, `${thankCase.name}: redirect started before /api/events`).toBeLessThanOrEqual(redirect!.ts);
    });
  }
});
