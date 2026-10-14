import { describe, expect, it } from "vitest";

import { orderLinkedHtml } from "./orderLinkCopy";

describe("bot answer to the order link", () => {
  it("names the stream's start date before the stream", () => {
    const html = orderLinkedHtml({
      name: "Анна",
      programTitle: "Шлях 21",
      cohortStartsOn: "2026-11-01",
      today: "2026-10-14",
    });
    expect(html).toContain("<b>Готово, Анна ✓</b>");
    expect(html).toContain("Ви в групі «Шлях 21». Старт — 1 листопада.");
    expect(html).toContain("напередодні старту");
  });

  it("points at the open lessons once the stream runs", () => {
    const html = orderLinkedHtml({
      name: null,
      programTitle: "Шлях 21",
      cohortStartsOn: "2026-11-01",
      today: "2026-11-01",
    });
    expect(html.startsWith("<b>Готово ✓</b>")).toBe(true);
    expect(html).toContain("потік іде з 1 листопада");
    expect(html).not.toContain("Старт —");
  });

  it("has no date for a course in the buyer's own pace", () => {
    const html = orderLinkedHtml({ name: "Ян", programTitle: "Reset Day", cohortStartsOn: null, today: "2026-10-14" });
    expect(html).toContain("«Reset Day» уже у вашому кабінеті.");
    expect(html).not.toMatch(/старт|потік/i);
  });

  it("escapes what the buyer typed", () => {
    expect(
      orderLinkedHtml({ name: "<i>A&B</i>", programTitle: "X", cohortStartsOn: null, today: "2026-10-14" }),
    ).toContain("Готово, &lt;i&gt;A&amp;B&lt;/i&gt; ✓");
  });
});
