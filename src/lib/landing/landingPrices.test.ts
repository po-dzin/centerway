/**
 * The whole commerce pass over the REAL landing files — the markers are part
 * of the contract, so a landing that loses one fails here rather than quietly
 * printing yesterday's formats.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BundleHost, ProgramFormat } from "@/lib/experiences/formats";

const state = vi.hoisted(() => ({
  formats: [] as unknown[],
  hosts: [] as unknown[] | null,
  prices: {} as Record<string, number>,
}));

vi.mock("@/lib/lms/liveCatalog", () => ({
  listLiveCourses: async () => [
    {
      id: "c-way21",
      slug: "way21",
      programSlug: "way21",
      title: "Шлях 21 — інтегративна детокс-програма",
      status: "published",
    },
    {
      id: "c-reset",
      slug: "reset-day",
      programSlug: "reset-day",
      title: "Розвантажувальний день",
      status: "published",
    },
  ],
}));
vi.mock("@/lib/experiences/formats", () => ({
  loadProgramFormats: async () => state.formats,
  loadBundleHosts: async () => state.hosts,
}));
vi.mock("@/lib/platform/productOffers", () => ({ loadProductOffer: async () => null }));
vi.mock("@/lib/platform/offers", () => ({
  loadPayableOffer: async (code: string) =>
    code in state.prices ? { amount: state.prices[code], listAmount: null } : null,
}));

const { hasLandingCommerce, syncLandingCommerce } = await import("./landingPrices");

const landing = (name: string) => readFileSync(join(process.cwd(), "src/landing-static", name, "index.html"), "utf8");

function format(code: string, kind: ProgramFormat["format"], extra: Partial<ProgramFormat> = {}): ProgramFormat {
  return {
    code,
    format: kind,
    label: kind === "group" ? "У групі потоку" : kind === "individual" ? "Індивідуальний супровід" : "Самостійно",
    summary: null,
    features: [],
    mode: kind === "individual" ? "lead" : "checkout",
    amount: kind === "individual" ? 9000 : 4100,
    listAmount: null,
    currency: "UAH",
    cohortStartsOn: kind === "group" ? "2026-10-01" : null,
    includes: [],
    ...extra,
  };
}

const minis = [
  { courseSlug: "reset-day", programSlug: "reset-day", title: "Розвантажувальний день", kind: "mini" as const },
  { courseSlug: "short", programSlug: "reboot", title: "Short-Перезавантаження", kind: "mini" as const },
];

const hosts: BundleHost[] = [
  { code: "way21-group", label: "У групі потоку", programSlug: "way21", programTitle: "Шлях 21" },
  { code: "way21-support", label: "Індивідуальний супровід", programSlug: "way21", programTitle: "Шлях 21" },
];

beforeEach(() => {
  state.formats = [
    format("course:way21", "self", { features: ["Покрокові інструкції на кожен день курсу"] }),
    format("way21-group", "group", { features: ["Закрита Telegram-група потоку"], includes: minis }),
    format("way21-support", "individual", { features: ["2 консультації з автором"], includes: minis }),
  ];
  state.hosts = hosts;
  state.prices = { way21: 4100, "way21-group": 4100, "course:way21": 4100, "reset-day": 795 };
});

function cardOf(html: string, code: string): string {
  const start = html.indexOf(`<!-- cw:format ${code} -->`);
  return html.slice(start, html.indexOf("<!-- /cw:format -->", start));
}

describe("Шлях 21 landing", () => {
  it("is a commerce page with a formats block and a bundle note", () => {
    const html = landing("way21");
    expect(hasLandingCommerce(html)).toBe(true);
    expect(html).toContain("<!-- cw:formats way21 -->");
    expect(html).toContain("<!-- cw:bundled-in reset-day -->");
  });

  it("prints every format on sale, each with the list the platform prints", async () => {
    const html = await syncLandingCommerce(landing("way21"));
    expect(cardOf(html, "course:way21")).toContain("<li>Покрокові інструкції на кожен день курсу</li>");
    expect(cardOf(html, "way21-group")).toContain("<li>Закрита Telegram-група потоку</li>");
    expect(cardOf(html, "way21-support")).toContain("<li>2 консультації з автором</li>");
    // The typed lists are gone where the data has one.
    expect(cardOf(html, "course:way21")).not.toContain("Усі інструкції трьох тижнів");
  });

  it("closes the group and guided cards with the bonus programs, not the self-paced one", async () => {
    const html = await syncLandingCommerce(landing("way21"));
    expect(cardOf(html, "course:way21")).not.toContain("data-cw-included");
    expect(cardOf(html, "way21-group").match(/data-cw-included/g)?.length).toBe(2);
    expect(cardOf(html, "way21-support")).toContain("Short-Перезавантаження — міні-курс");
  });

  it("says in the Reset Day section which formats include it", async () => {
    const html = await syncLandingCommerce(landing("way21"));
    expect(html).toContain("Розвантажувальний день також входить бонусом");
    expect(html).toContain("у форматах «У групі потоку» і «Індивідуальний супровід»");
  });

  it("drops the card of a format no longer on sale", async () => {
    state.formats = state.formats.slice(0, 2);
    const html = await syncLandingCommerce(landing("way21"));
    expect(html).not.toContain("<!-- cw:format way21-support -->");
  });

  it("keeps the typed page when formats and bundles cannot be read", async () => {
    state.formats = [];
    state.hosts = null;
    const html = await syncLandingCommerce(landing("way21"));
    expect(cardOf(html, "course:way21")).toContain("Усі інструкції трьох тижнів");
    expect(html).not.toContain("data-cw-bundled-in");
  });
});

describe("Reset Day landing", () => {
  it("says it comes as a bonus with Шлях 21, linking to the formats", async () => {
    const html = await syncLandingCommerce(landing("reset-day"));
    expect(html).toContain('href="https://www.centerway.net.ua/programs/way21#formats"');
    expect(html).toContain("Розвантажувальний день також входить бонусом у");
  });

  it("says nothing once no format includes it", async () => {
    state.hosts = [];
    const html = await syncLandingCommerce(landing("reset-day"));
    expect(html).not.toContain("data-cw-bundled-in");
  });
});

describe("Short landings stay inside their author's brand", () => {
  it.each(["short", "short-b"])("%s carries no bundle note and no link to the hub", (name) => {
    const html = landing(name);
    expect(html).not.toContain("cw:bundled-in");
    expect(html).not.toContain("cw:formats");
  });
});
