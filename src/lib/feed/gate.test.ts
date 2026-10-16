import { describe, expect, it } from "vitest";

import { checkFeedText } from "./gate";

describe("feed gate (rules)", () => {
  it("passes an ordinary practice post", () => {
    const verdict = checkFeedText(
      "Три хвилини дихання до телефону. Спробуйте завтра і напишіть собі, що змінилось до обіду. https://www.centerway.net.ua/programs/way21",
    );
    expect(verdict.pass).toBe(true);
    expect(verdict.checks).toHaveLength(3);
  });

  it("passes words people use honestly", () => {
    expect(checkFeedText("Порадьтеся з лікарем, якщо тиск скаче. Здоров'я — це ритм.").pass).toBe(true);
  });

  it("stops a promise to cure", () => {
    const verdict = checkFeedText("Ця практика зцілює тривогу назавжди.");
    expect(verdict.pass).toBe(false);
    expect(verdict.findings[0]?.rule).toBe("claims");
  });

  it("stops each claim on its own", () => {
    expect(checkFeedText("Цей чай вилікує вас.").pass).toBe(false);
    expect(checkFeedText("Гарантую результат за тиждень.").pass).toBe(false);
    expect(checkFeedText("Пийте трави замість ліків.").pass).toBe(false);
  });

  it("stops a foreign link and names its host", () => {
    const verdict = checkFeedText("Знижка 30 % у моєму салоні: https://massage-salon.com/promo");
    expect(verdict.pass).toBe(false);
    expect(verdict.findings[0]).toMatchObject({ rule: "links", detail: "посилання: massage-salon.com" });
  });

  it("lets the platform's own Telegram through", () => {
    expect(checkFeedText("Обговорюємо в https://t.me/cway_flow").pass).toBe(true);
  });

  it("stops shouting", () => {
    expect(checkFeedText("ТЕРМІНОВО ЗАПИСУЙТЕСЬ НА МІЙ КУРС ПОКИ Є МІСЦЯ ВСІМ ВСІМ ВСІМ").findings[0]?.rule).toBe(
      "spam",
    );
  });
});
