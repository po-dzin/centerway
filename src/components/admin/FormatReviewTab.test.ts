/**
 * ProgramFormats — a program's formats, folded under its row in «Ціни й доступ».
 *
 * Guards:
 *  - the head counts the formats, the ones waiting, and names every format with
 *    its price (base included, an enquiry marked); it opens by itself when
 *    something waits and stays folded otherwise;
 *  - inside, formats keep the page's order (self, group, guided), and the base
 *    format — the row's own price — is listed only while a decision on it waits;
 *  - a format waits for a decision — and shows the price form — exactly when
 *    `!approved || pendingPrice`: drafts, proposals and declined formats, and a
 *    live format only while a new price waits beside the current one;
 *  - the price form is prefilled with the proposal (else the current price),
 *    a draft cannot be declined, a pending price is declined as a price;
 *  - a live format with nothing waiting offers withdraw / resume instead;
 *  - a viewer without edit rights sees no controls at all.
 *
 * `t` is mocked to echo its key, so assertions name i18n keys, not copy.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { FormatReviewRow } from "@/lib/admin/formatReviewTypes";

vi.mock("@/components/I18nProvider", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));
vi.mock("@/components/ToastProvider", () => ({
  useToast: () => ({ success: () => {}, error: () => {} }),
}));
vi.mock("@/components/auth/authorizedFetch", () => ({
  authorizedJson: vi.fn(),
}));

const { ProgramFormats } = await import("./FormatReviewTab");

function row(overrides: Partial<FormatReviewRow> & Pick<FormatReviewRow, "code" | "format">): FormatReviewRow {
  return {
    label: "Самостійно",
    summary: "",
    mode: "checkout",
    amount: 1500,
    proposedAmount: null,
    currency: "UAH",
    cohortStartsOn: null,
    reviewStatus: "approved",
    active: true,
    includes: [],
    courseSlug: "way21",
    courseTitle: "Шлях 21",
    ...overrides,
  };
}

function render(formats: FormatReviewRow[], canEdit = true, defaultOpen: boolean | "auto" = true) {
  return renderToStaticMarkup(
    createElement(ProgramFormats, {
      formats,
      baseCode: "course:way21",
      canEdit,
      defaultOpen: defaultOpen === "auto" ? undefined : defaultOpen,
      errorText: (m: string) => m,
      onChanged: async () => {},
    }),
  );
}

/** The `<li>` of one format, by its code. */
function item(html: string, code: string): string {
  const at = html.indexOf(`<code>${code}</code>`);
  expect(at).toBeGreaterThan(-1);
  const start = html.lastIndexOf("<li", at);
  const end = html.indexOf("</li>", at);
  return html.slice(start, end);
}

describe("FormatReviewTab", () => {
  it("renders nothing for a program sold as its one base offer", () => {
    expect(render([])).toBe("");
    expect(render([row({ code: "course:way21", format: "self" })])).toBe("");
  });

  it("names the whole ladder in the head and lists formats in page order, the base only while it waits", () => {
    const formats = [
      row({
        code: "way21_ind",
        format: "individual",
        label: "Супровід",
        reviewStatus: "draft",
        amount: null,
        mode: "lead",
      }),
      row({
        code: "way21_group",
        format: "group",
        label: "Потік",
        reviewStatus: "proposed",
        amount: null,
        proposedAmount: 3900,
      }),
      row({ code: "course:way21", format: "self", amount: 3900, mode: "lead" }),
    ];
    const html = render(formats);
    expect(html).toContain("formats_count: 3 · <strong");
    expect(html).toContain("formats_waiting: 2</strong>");
    expect(html).toContain(
      "Самостійно 3900 UAH (formats_mode_lead) · Потік products_price_on_request · Супровід products_price_on_request (formats_mode_lead)",
    );
    // The base is the row's own price: not listed while nothing waits on it.
    expect(html).not.toContain("<code>course:way21</code>");
    expect(html.indexOf("<code>way21_group</code>")).toBeLessThan(html.indexOf("<code>way21_ind</code>"));
    // …and listed, first, once it does.
    const waiting = render([
      ...formats.slice(0, 2),
      row({ code: "course:way21", format: "self", proposedAmount: 3500 }),
    ]);
    expect(waiting.indexOf("<code>course:way21</code>")).toBeLessThan(waiting.indexOf("<code>way21_group</code>"));
  });

  it("opens by itself when something waits, and stays folded when nothing does", () => {
    const quiet = [row({ code: "course:way21", format: "self" }), row({ code: "g", format: "group" })];
    const folded = render(quiet, true, "auto");
    expect(folded).toContain('aria-expanded="false"');
    expect(folded).not.toContain("<code>g</code>");
    const busy = render([...quiet, row({ code: "p", format: "individual", reviewStatus: "proposed" })], true, "auto");
    expect(busy).toContain('aria-expanded="true"');
    expect(busy).toContain("<code>p</code>");
  });

  it("gives a proposal the price form prefilled with the proposed price, approve and decline", () => {
    const html = render([
      row({
        code: "g",
        format: "group",
        reviewStatus: "proposed",
        amount: null,
        proposedAmount: 3900,
        cohortStartsOn: "2026-10-01",
        includes: [{ slug: "reset-day", title: "Reset Day" }],
      }),
    ]);
    const li = item(html, "g");
    expect(li).toContain("formats_review_proposed");
    expect(li).toContain("products_price_on_request → 3900 UAH");
    expect(li).toContain("formats_cohort: 2026-10-01");
    expect(li).toContain("formats_includes: Reset Day");
    expect(li).toContain("formats_proposed_price");
    expect(li).toContain('value="3900"');
    expect(li).toContain("formats_list_amount");
    expect(li).toContain("formats_approve");
    expect(li).toContain(">formats_decline<");
  });

  it("lets a draft be priced and approved, but not declined", () => {
    const li = item(
      render([row({ code: "d", format: "individual", reviewStatus: "draft", mode: "lead", amount: null })]),
      "d",
    );
    expect(li).toContain("formats_review_draft");
    expect(li).toContain("formats_mode_lead");
    expect(li).toContain("formats_final_amount");
    expect(li).toContain('value=""');
    expect(li).toContain("formats_approve");
    expect(li).not.toContain("formats_decline");
  });

  it("shows the price form on a declined format", () => {
    const li = item(render([row({ code: "x", format: "group", reviewStatus: "declined", amount: 2000 })]), "x");
    expect(li).toContain("formats_review_declined");
    expect(li).toContain('value="2000"');
    expect(li).toContain("formats_approve");
  });

  it("shows the form on a live format only while a new price waits, declined as a price", () => {
    const li = item(render([row({ code: "p", format: "self", amount: 1500, proposedAmount: 1800 })]), "p");
    expect(li).toContain("1500 UAH → 1800 UAH");
    expect(li).toContain('value="1800"');
    expect(li).toContain("formats_approve");
    expect(li).toContain("formats_decline_price");
    expect(li).not.toContain("products_withdraw");
  });

  it("offers withdraw on a live format with nothing waiting, and resume on a withdrawn one", () => {
    const html = render([row({ code: "live", format: "self" }), row({ code: "off", format: "group", active: false })]);
    const live = item(html, "live");
    expect(live).toContain("formats_review_approved");
    expect(live).toContain("products_withdraw");
    expect(live).not.toContain("formats_approve");
    expect(live).not.toContain("<input");

    const off = item(html, "off");
    expect(off).toContain("formats_withdrawn");
    expect(off).toContain("products_resume");
    expect(html).toContain("formats_count: 2</p>");
  });

  it("shows no controls to a viewer who cannot edit", () => {
    const html = render(
      [
        row({ code: "g", format: "group", reviewStatus: "proposed", proposedAmount: 3900 }),
        row({ code: "s", format: "self" }),
      ],
      false,
    );
    expect(html).not.toContain("<input");
    // The chevron is the only button: it opens, it does not decide.
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).toContain("formats_waiting: 1");
  });
});
