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
import { describe, expect, it } from "vitest";

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
    expect(html).toContain("Старт потоку — 1 жовтня");

    expect(render([SELF])).not.toContain("Старт потоку");
    expect(render([format({ code: "g", format: "group", cohortStartsOn: "not-a-date" })])).not.toContain(
      "Старт потоку",
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
    expect(html).toMatch(/>Міні-курс<\/span> <a href="\/programs\/reset-day-program">/);
    expect(html).toContain('href="/programs/short"');
    expect(html).toContain('>Чек-лист</span> <a href="/programs/short">');

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
});
