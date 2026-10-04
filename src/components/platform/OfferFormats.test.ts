/**
 * OfferFormats — the formats of one program side by side (`#formats`).
 *
 * Guards what a buyer is promised on each card: the price (or «Ціна за
 * запитом»), the struck-through compare-at price only when it is really
 * higher, the cohort start for a group, the author's `features` (with the one
 * certainly-true fallback when none are written), the bonus programs linking to
 * their own pages, and the action — a checkout link for a priced format, an
 * anchor to the folded enquiry form for a lead format. Also the legal line.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProgramFormat } from "@/lib/experiences/formats";
import { formatPrice } from "@/lib/products";
import { OfferFormats } from "./OfferFormats";

function format(overrides: Partial<ProgramFormat> & Pick<ProgramFormat, "code" | "format">): ProgramFormat {
  return {
    label: "Самостійно",
    summary: null,
    features: [],
    mode: "checkout",
    amount: 1500,
    listAmount: null,
    currency: "UAH",
    cohortStartsOn: null,
    featured: false,
    early: null,
    earlyAmount: null,
    earlyUntil: null,
    regularAmount: null,
    regularListAmount: null,
    includes: [],
    ...overrides,
  };
}

const SELF = format({
  code: "course:way21",
  format: "self",
  label: "Самостійно",
  amount: 1500,
  listAmount: 2100,
  features: ["21 день протоколу", "Довідкові матеріали"],
});

const GROUP = format({
  code: "way21_group",
  format: "group",
  label: "У групі потоку",
  amount: 3900,
  cohortStartsOn: "2026-10-01",
  includes: [
    { courseSlug: "reset-day", programSlug: "reset-day-program", title: "Reset Day", kind: "mini" },
    { courseSlug: "short-checklist", programSlug: "short", title: "Short", kind: "checklist" },
  ],
});

const GUIDED = format({
  code: "way21_individual",
  format: "individual",
  label: "Індивідуальний супровід",
  mode: "lead",
  amount: null,
  features: [],
});

function render(formats: ProgramFormat[]) {
  return renderToStaticMarkup(createElement(OfferFormats, { programSlug: "way21", programTitle: "Шлях 21", formats }));
}

describe("OfferFormats", () => {
  it("is the #formats anchor with a heading naming the program", () => {
    const html = render([SELF]);
    expect(html).toContain('id="formats"');
    expect(html).toContain("Як пройти «Шлях 21»");
  });

  it("renders one card per format, tagged with its kind", () => {
    const html = render([SELF, GROUP, GUIDED]);
    expect(html).toContain('data-format="self"');
    expect(html).toContain('data-format="group"');
    expect(html).toContain('data-format="individual"');
    expect(html).toContain("Самостійно");
    expect(html).toContain("У групі потоку");
    expect(html).toContain("Індивідуальний супровід");
  });

  it("shows the price, and the compare-at price only when the list price is higher", () => {
    const html = render([SELF, GROUP]);
    expect(html).toContain(formatPrice(1500, "UAH"));
    expect(html).toContain(`<s`);
    expect(html).toContain(formatPrice(2100, "UAH"));
    // One struck price in total: GROUP has no list price.
    expect(html.match(/<s[\s>]/g)).toHaveLength(1);

    const equal = render([format({ code: "x", format: "self", amount: 900, listAmount: 900 })]);
    expect(equal).not.toMatch(/<s[\s>]/);
    const lower = render([format({ code: "x", format: "self", amount: 900, listAmount: 500 })]);
    expect(lower).not.toMatch(/<s[\s>]/);
    expect(lower).not.toContain(formatPrice(500, "UAH"));
  });

  it("says «Ціна за запитом» for a format without an amount", () => {
    const html = render([GUIDED]);
    expect(html).toContain("Ціна за запитом");
  });

  it("dates the cohort start of a group format, and says nothing for an invalid date", () => {
    const html = render([GROUP]);
    // 1 October is behind the render date: a dated start, no longer the nearest.
    expect(html).toContain("Старт потоку · 1 жовтня");

    expect(render([SELF])).not.toMatch(/Старт потоку|Найближчий потік/);
    expect(render([format({ code: "g", format: "group", cohortStartsOn: "not-a-date" })])).not.toMatch(
      /Старт потоку|Найближчий потік/,
    );
  });

  it("lists the author's features, and falls back to the program in full when there are none", () => {
    const html = render([SELF]);
    expect(html).toContain("21 день протоколу");
    expect(html).toContain("Довідкові матеріали");
    expect(html).not.toContain("«Шлях 21» повністю");

    expect(render([GROUP])).toContain("«Шлях 21» повністю");
  });

  it("lists bonus programs under «Бонусом», each linking to its own program page", () => {
    const html = render([GROUP]);
    expect(html).toContain("Бонусом");
    expect(html).toContain('href="/programs/reset-day-program"');
    expect(html).toContain("Reset Day");
    // The kind comes before the name (G, 2026-10-03).
    expect(html).toMatch(/>Міні-курс<\/span><a [^>]*href="\/programs\/reset-day-program">/);
    expect(html).toContain('href="/programs/short"');
    expect(html).toMatch(/>Чек-лист<\/span><a [^>]*href="\/programs\/short">/);

    expect(render([SELF])).not.toContain("Бонусом");
  });

  it("gives a priced checkout format a checkout link to /api/pay/start", () => {
    const html = render([SELF]);
    const href = `/api/pay/start?product=${encodeURIComponent("course:way21")}&amp;cta_place=${encodeURIComponent(
      "way21_format_course:way21",
    )}&amp;source=platform_offer`;
    expect(html).toContain(`href="${href}"`);
    expect(html).toContain(`Оплатити ${formatPrice(1500, "UAH")}`);
    expect(html).not.toContain("Залишити заявку");
  });

  it("gives a lead format an anchor to its folded enquiry form under the grid", () => {
    const html = render([SELF, GUIDED]);
    expect(html).toContain('href="#format-request-way21_individual"');
    expect(html).toContain("Залишити заявку");
    expect(html).toContain('id="format-request-way21_individual"');
    expect(html).toContain("Заявка: індивідуальний супровід");
    // Only lead formats get a request block.
    expect(html).not.toContain('id="format-request-course:way21"');
    // The form comes after the card grid.
    expect(html.indexOf('id="format-request-way21_individual"')).toBeGreaterThan(
      html.indexOf('data-format="individual"'),
    );
    // No checkout link for the lead format.
    expect(html).not.toContain("product=way21_individual");
  });

  it("carries the legal line with offer and privacy links", () => {
    const html = render([SELF]);
    expect(html).toContain('href="/legal/public-offer"');
    expect(html).toContain('href="/legal/privacy"');
    expect(html).toContain("WayForPay");
  });

  describe("early price and bonus rows (G, 2026-10-03)", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    const EARLY = format({
      code: "way21_group",
      format: "group",
      label: "У групі потоку",
      amount: 3400,
      listAmount: 4100,
      cohortStartsOn: "2026-11-01",
      featured: true,
      early: { until: "2026-10-15", endsAt: "2026-10-14T21:00:00.000Z", laterAmount: 4100 },
      includes: [
        {
          courseSlug: "short",
          programSlug: "reboot",
          title: "Short-Перезавантаження",
          kind: "mini",
          tag: "Міні-курс",
          duration: "7 днів",
          cover: "/covers/reboot.webp",
          separateAmount: 890,
          currency: "UAH",
        },
      ],
    });

    it("strikes the later price, counts down to the date and says the whole ladder in one line", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-12T10:28:00.000Z"));
      const html = render([SELF, EARLY]);
      expect(html).toMatch(new RegExp(`<s[^>]*>${formatPrice(4100, "UAH")}</s>`));
      expect(html).toContain("Рання ціна діє ще");
      expect(html).toContain(`До 15 жовтня ${formatPrice(3400, "UAH")}, далі ${formatPrice(4100, "UAH")}`);
      // 2 days 10 hours 32 minutes to 00:00 Kyiv on 15 October.
      expect(html).toContain("<b>02</b>");
      expect(html).toContain("<b>10</b>");
      expect(html).toContain("<b>32</b>");
      // The timer counts, so the cohort line does not count again.
      expect(html).toContain("Найближчий потік · 1 листопада<");
    });

    it("shows a bonus as a row: cover, badge and length, name, what it costs on its own", () => {
      const html = render([EARLY]);
      expect(html).toContain('src="/covers/reboot.webp"');
      expect(html).toContain(">Міні-курс · 7 днів</span>");
      expect(html).toContain(`окремо ${formatPrice(890, "UAH")}`);
    });

    it("keeps «Оплатити» for the marked format and says «Обрати» on the others", () => {
      const html = render([SELF, EARLY]);
      expect(html).toContain(`Оплатити ${formatPrice(3400, "UAH")}`);
      expect(html).toContain(">Обрати<");
      expect(html).not.toContain(`Оплатити ${formatPrice(1500, "UAH")}`);
    });
  });
});
