import { describe, expect, it } from "vitest";

import { isStorableQuestion, redactPersonal } from "./redact";

describe("redactPersonal", () => {
  it("removes an email but keeps the sentence around it", () => {
    const { text, removed } = redactPersonal("Оплатив, але доступу немає. Пошта ivan.petrov+cw@gmail.com");
    expect(text).toBe("Оплатив, але доступу немає. Пошта [пошта]");
    expect(removed).toContain("email");
  });

  it("removes a phone in any of the shapes people type it", () => {
    for (const phone of ["+38 (063) 602 44 50", "0636024450", "+380636024450", "063-602-44-50"]) {
      expect(redactPersonal(`Мій номер ${phone}, передзвоніть`).text).toBe("Мій номер [номер], передзвоніть");
    }
  });

  it("removes an order reference the same way, because it cannot tell them apart", () => {
    // Ten digits is both a mobile number and an order reference. The label is
    // «номер» for both rather than a guess that is wrong half the time.
    expect(redactPersonal("замовлення 1029384756 не пройшло").text).toBe("замовлення [номер] не пройшло");
  });

  it("removes a telegram handle without eating an email's local part", () => {
    // A naive @-rule turns "ivan@gmail.com" into "ivan[нік]" — the address
    // survives in pieces, which is worse than not redacting at all because it
    // looks clean.
    const { text } = redactPersonal("пишіть @ivan_petrov або на ivan@gmail.com");
    expect(text).toBe("пишіть [нік] або на [пошта]");
  });

  it("leaves a question with no personal data untouched", () => {
    const question = "Скільки триває Шлях 21 і чи можна проходити повільніше?";
    expect(redactPersonal(question).text).toBe(question);
    expect(redactPersonal(question).removed).toEqual([]);
  });

  it("does not mistake a course number for a personal one", () => {
    // «Шлях 21» must survive: the digit run rule starts at five digits exactly
    // so that product names, day numbers and prices stay readable.
    expect(redactPersonal("чи є знижка на Шлях 21 за 4100 грн").text).toBe("чи є знижка на Шлях 21 за 4100 грн");
  });
});

describe("isStorableQuestion", () => {
  it("keeps a real question", () => {
    expect(isStorableQuestion("Де подивитися свій прогрес у курсі?")).toBe(true);
  });

  it("drops an acknowledgement", () => {
    expect(isStorableQuestion("дякую")).toBe(false);
    expect(isStorableQuestion("ок")).toBe(false);
  });

  it("drops a message that was only a contact detail", () => {
    // The bot asks for a contact one step before it asks for the message, and
    // people paste it twice. After redaction this is "[пошта]" — a row that
    // would sit in the corpus forever having taught us nothing.
    expect(isStorableQuestion(redactPersonal("ivan.petrov@gmail.com").text)).toBe(false);
    expect(isStorableQuestion(redactPersonal("+38 063 602 44 50").text)).toBe(false);
  });
});
