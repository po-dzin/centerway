import { describe, expect, it } from "vitest";

import type { ProgramFormat } from "@/lib/experiences/formats";
import { applyFormatSync, collectFormatPrograms } from "./formatSync";

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
});
