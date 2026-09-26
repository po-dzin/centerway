import { describe, expect, it } from "vitest";

import type { ProgramFormat } from "@/lib/experiences/formats";
import {
  applyBundleSync,
  applyFormatSync,
  collectBundledPrograms,
  collectFormatPrograms,
  renderBundleNote,
  renderFormatCard,
} from "./formatSync";
import type { BundleHost } from "@/lib/experiences/formats";

const page = `<div class="format-grid">
<!-- cw:formats way21 -->
<!-- cw:format course:way21 --><div class="format-card self"><ul class="fc-features"><li>Усі інструкції</li></ul></div><!-- /cw:format -->
<!-- cw:format way21-support --><div class="format-card premium"><ul class="fc-features"><li>2 консультації</li></ul></div><!-- /cw:format -->
<!-- /cw:formats -->
</div>`;

function format(code: string, kind: ProgramFormat["format"], extra: Partial<ProgramFormat> = {}): ProgramFormat {
  return {
    code,
    format: kind,
    label: kind,
    summary: null,
    features: [],
    mode: kind === "individual" ? "lead" : "checkout",
    amount: 4100,
    listAmount: null,
    currency: "UAH",
    cohortStartsOn: null,
    includes: [],
    ...extra,
  };
}

const minis = [
  { courseSlug: "reset-day", programSlug: "reset-day", title: "Розвантажувальний день", kind: "mini" as const },
  { courseSlug: "short", programSlug: "reboot", title: "Short", kind: "mini" as const },
];

describe("landing format sync", () => {
  it("finds the programs a page asks for", () => {
    expect(collectFormatPrograms(page)).toEqual(["way21"]);
  });

  it("keeps typed cards, adds a card for a format the page lacks, and lists what bundles open", () => {
    const out = applyFormatSync(page, () => ({
      title: "Шлях 21",
      formats: [
        format("course:way21", "self"),
        format("way21-group", "group", { cohortStartsOn: "2026-10-01", includes: minis }),
        format("way21-support", "individual", { amount: 9000, includes: minis }),
      ],
    }));
    expect(out).toContain("<li>Усі інструкції</li>");
    expect(out).toContain('data-cw-product="way21-group"');
    expect(out).toContain('data-cw-price="way21-group"');
    expect(out).toContain("старт потоку 1 жовтня");
    expect(out.indexOf("way21-group")).toBeLessThan(out.indexOf("2 консультації"));
    expect(out.match(/data-cw-included/g)?.length).toBe(4);
  });

  it("drops a card whose format is no longer on sale", () => {
    const out = applyFormatSync(page, () => ({ title: "Шлях 21", formats: [format("course:way21", "self")] }));
    expect(out).not.toContain("2 консультації");
  });

  it("leaves the typed cards alone when formats could not be read", () => {
    expect(applyFormatSync(page, () => null)).toBe(page);
    expect(applyFormatSync(page, () => ({ title: "Шлях 21", formats: [] }))).toBe(page);
  });

  it("does not repeat the included programs when a page is synced twice", () => {
    const formats = [format("way21-support", "individual", { includes: minis })];
    const once = applyFormatSync(page, () => ({ title: "Шлях 21", formats }));
    const twice = applyFormatSync(once, () => ({ title: "Шлях 21", formats }));
    expect(twice.match(/data-cw-included/g)?.length).toBe(2);
  });

  it("lists a new card's features from the format itself, then its bonus programs", () => {
    const card = renderFormatCard(
      format("way21-group", "group", { features: ["Закрита Telegram-група потоку"], includes: minis }),
      "Шлях 21",
    );
    expect(card).toContain("<li>Закрита Telegram-група потоку</li>");
    expect(card).not.toContain("Уся програма");
    expect(card.match(/data-cw-included/g)?.length).toBe(2);
  });

  it("replaces a typed card's list with the format's own features, then its bonus programs", () => {
    const out = applyFormatSync(page, () => ({
      title: "Шлях 21",
      formats: [
        format("course:way21", "self", { features: ["Покрокові інструкції", "Текстова підтримка протягом курсу"] }),
        format("way21-support", "individual", { features: [], includes: minis }),
      ],
    }));
    const self = out.slice(out.indexOf("cw:format course:way21"), out.indexOf("cw:format way21-support"));
    expect(self).toContain("<li>Покрокові інструкції</li><li>Текстова підтримка протягом курсу</li>");
    expect(self).not.toContain("Усі інструкції");
    // No features written for the guided format: its typed list stands, the bonuses close it.
    const support = out.slice(out.indexOf("cw:format way21-support"));
    expect(support).toContain("<li>2 консультації</li>");
    expect(support.match(/data-cw-included/g)?.length).toBe(2);
  });

  it("is stable when the synced page is synced again", () => {
    const formats = [format("course:way21", "self", { features: ["A", "B"], includes: minis })];
    const once = applyFormatSync(page, () => ({ title: "Шлях 21", formats }));
    expect(applyFormatSync(once, () => ({ title: "Шлях 21", formats }))).toBe(once);
  });

  it("escapes what an author typed into a feature", () => {
    const out = applyFormatSync(page, () => ({
      title: "Шлях 21",
      formats: [format("course:way21", "self", { features: ['<script>alert(1)</script> & "лапки"'] })],
    }));
    expect(out).not.toContain("<script>");
    expect(out).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;лапки&quot;");
  });
});

const hosts: BundleHost[] = [
  { code: "way21-group", label: "У групі потоку", programSlug: "way21", programTitle: "Шлях 21" },
  { code: "way21-support", label: "Індивідуальний супровід", programSlug: "way21", programTitle: "Шлях 21" },
];

const bundled = `<div class="short-text"><p>Pitch</p>
<!-- cw:bundled-in reset-day --><!-- /cw:bundled-in -->
</div>`;

describe("landing bundle sync", () => {
  it("finds the included programs a page asks about", () => {
    expect(collectBundledPrograms(bundled)).toEqual(["reset-day"]);
    expect(collectBundledPrograms("<p>none</p>")).toEqual([]);
  });

  it("names the host program and every format that opens this one, linking to its formats", () => {
    const note = renderBundleNote("Розвантажувальний день", hosts);
    expect(note).toContain("Розвантажувальний день також входить бонусом");
    expect(note).toContain('href="https://www.centerway.net.ua/programs/way21#formats"');
    expect(note).toContain("у форматах «У групі потоку» і «Індивідуальний супровід»");
  });

  it("says «у форматі» for one format and separates host programs", () => {
    const note = renderBundleNote("Short", [
      hosts[0]!,
      { code: "natural-body-group", label: "У групі", programSlug: "natural-body", programTitle: "Природне тіло" },
    ]);
    expect(note).toContain("«Шлях 21»</a> — у форматі «У групі потоку»; у ");
    expect(note).toContain("«Природне тіло»</a> — у форматі «У групі»");
  });

  it("fills the marker, and filling it twice changes nothing", () => {
    const once = applyBundleSync(bundled, () => ({ title: "Розвантажувальний день", hosts }));
    expect(once).toContain("data-cw-bundled-in");
    expect(applyBundleSync(once, () => ({ title: "Розвантажувальний день", hosts }))).toBe(once);
  });

  it("empties the marker when the program is in no bundle any more", () => {
    const filled = applyBundleSync(bundled, () => ({ title: "Розвантажувальний день", hosts }));
    const emptied = applyBundleSync(filled, () => ({ title: "Розвантажувальний день", hosts: [] }));
    expect(emptied).not.toContain("data-cw-bundled-in");
    expect(emptied).toContain("<!-- cw:bundled-in reset-day --><!-- /cw:bundled-in -->");
  });

  it("leaves the marker exactly as it is when the read failed", () => {
    const filled = applyBundleSync(bundled, () => ({ title: "Розвантажувальний день", hosts }));
    expect(applyBundleSync(filled, () => null)).toBe(filled);
  });
});
