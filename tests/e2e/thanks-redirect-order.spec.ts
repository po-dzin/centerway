import { expect, test } from "@playwright/test";

const baseUrl = (process.env.SMOKE_UI_BASE_URL || "http://127.0.2.2:8002").replace(/\/+$/, "");

const thanksCases = [
  {
    name: "way21",
    path: "/way21/thanks?product=way21&order_ref=smoke-way21&payment_id=rrn-way21&amount=3100&currency=UAH",
    pageAttr: "thanks",
    botHref: "https://t.me/E_Koriakin",
  },
  {
    name: "reset-day",
    path: "/reset-day/thanks?product=reset-day&order_ref=smoke-reset&payment_id=rrn-reset&amount=795&currency=UAH",
    pageAttr: "thanks",
    botHref: "https://t.me/E_Koriakin",
  },
] as const;

test.describe("thanks redirect order smoke", () => {
  for (const thankCase of thanksCases) {
    test(`${thankCase.name}: client signal starts before telegram redirect`, async ({ page }) => {
      const events: Array<{ type: "signal" | "redirect"; url: string; method: string; ts: number }> = [];

      page.on("request", (request) => {
        const url = request.url();
        if (url.includes("/api/events")) {
          events.push({ type: "signal", url, method: request.method(), ts: Date.now() });
        }
        if (url.startsWith("https://t.me/")) {
          events.push({ type: "redirect", url, method: request.method(), ts: Date.now() });
        }
      });

      const response = await page.goto(`${baseUrl}${thankCase.path}`, { waitUntil: "domcontentloaded" });
      expect(response, `${thankCase.name}: missing main document response`).not.toBeNull();
      expect(response!.status(), `${thankCase.name}: thanks page must open successfully`).toBe(200);

      await expect(page.locator(`html[data-cw-page="${thankCase.pageAttr}"]`)).toBeVisible();
      const botButton = page.getByRole("link", { name: "Відкрити бот" });
      await expect(botButton).toBeVisible();
      await expect(botButton).toHaveAttribute("href", thankCase.botHref);

      await page.waitForFunction(() => typeof window.CW_purchaseRedirectGate !== "undefined");
      await page.waitForTimeout(4600);

      const signal = events.find((entry) => entry.type === "signal" && entry.method === "POST");
      const redirect = events.find((entry) => entry.type === "redirect");

      expect(signal, `${thankCase.name}: /api/events request must start`).toBeTruthy();
      expect(redirect, `${thankCase.name}: telegram redirect must start`).toBeTruthy();
      expect(signal!.ts, `${thankCase.name}: redirect started before /api/events`).toBeLessThanOrEqual(redirect!.ts);
    });
  }
});
