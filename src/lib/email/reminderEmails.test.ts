import { describe, expect, it } from "vitest";

import { buildLessonReminderEmail, buildUnstartedReminderEmail } from "./reminderEmails";

const SUPPORT = "https://telegram.me/centerway_support_bot";

describe("lesson reminder letter", () => {
  const letter = buildLessonReminderEmail({
    name: "Анна Коваль",
    courseTitle: "Шлях 21",
    lessonTitle: "Ранкова опора",
    dayNumber: 3,
    lessonUrl: "https://my.centerway.net.ua/learn/way21/day-3",
    supportUrl: SUPPORT,
  });

  it("names the day, the course and the lesson", () => {
    expect(letter.subject).toBe("День 3 · Шлях 21");
    expect(letter.preheader).toBe("«Ранкова опора» — урок готовий. Заходьте, коли буде зручно.");
    expect(letter.text).toContain("Вітаємо, Анна!");
    expect(letter.text).toContain("«Ранкова опора»");
    expect(letter.html).toContain("Ранкова опора");
    expect(letter.html).toContain("Шлях 21");
  });

  it("links the lesson itself and the support bot, in both parts", () => {
    expect(letter.html).toContain('href="https://my.centerway.net.ua/learn/way21/day-3"');
    expect(letter.text).toContain("Відкрити урок: https://my.centerway.net.ua/learn/way21/day-3");
    expect(letter.html).toContain(`href="${SUPPORT}"`);
    expect(letter.text).toContain(SUPPORT);
  });

  it("says why it came by email", () => {
    expect(letter.text).toContain("не підключено Telegram");
  });

  it("escapes a title that tries to be markup", () => {
    const hostile = buildLessonReminderEmail({
      courseTitle: "<b>x</b>",
      lessonTitle: "<script>",
      dayNumber: 1,
      lessonUrl: "https://my.centerway.net.ua/learn/x/day-1",
      supportUrl: SUPPORT,
    });
    expect(hostile.html).not.toContain("<script>");
    expect(hostile.html).not.toContain("<b>x</b>");
    expect(hostile.text).toContain("Вітаємо!");
  });
});

describe("unstarted course letter", () => {
  const base = {
    courseTitle: "Reset Day",
    courseUrl: "https://my.centerway.net.ua/learn/reset-day",
    supportUrl: SUPPORT,
  };

  it("first nudge: where the course is, no hurry", () => {
    const letter = buildUnstartedReminderEmail({ ...base, nudgeNumber: 1 });
    expect(letter.subject).toBe("«Reset Day» вже у вашому кабінеті");
    expect(letter.text).toContain("«Reset Day» вже відкритий у вашому кабінеті.");
    expect(letter.text).toContain("Почати курс: https://my.centerway.net.ua/learn/reset-day");
    expect(letter.html).toContain('href="https://my.centerway.net.ua/learn/reset-day"');
    expect(letter.text).not.toContain("Відлік днів");
  });

  it("a later nudge says the days have not started counting", () => {
    const letter = buildUnstartedReminderEmail({ ...base, nudgeNumber: 2, name: "Олег" });
    expect(letter.subject).toBe("Нагадуємо: «Reset Day» чекає в кабінеті");
    expect(letter.preheader).toContain("ви нічого не пропустили");
    expect(letter.text).toContain("Відлік днів починається з першого відкриття");
    expect(letter.text).toContain("Вітаємо, Олег!");
  });
});
