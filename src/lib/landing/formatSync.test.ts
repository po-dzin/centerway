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
  it("tones every card by its format's kind, dropping the old dark and light materials", () => {
    const typed = page.replace(
      '<div class="format-card self">',
      '<div class="format-card self reveal" data-cw-nav-dark>',
    );
    const out = applyFormatSync(typed, () => ({
      title: "Шлях 21",
      formats: [
        format("course:way21", "self"),
        format("way21-group", "group"),
        format("way21-support", "individual", { amount: 9000 }),
      ],
    }));
    expect(out).toContain('<div class="format-card reveal" data-format="group">');
    // No cohort ahead here: the self-paced card keeps the gold and is marked.
    expect(out).toContain('<div class="format-card reveal" data-format="self" data-featured>');
    expect(out).toContain('<div class="format-card" data-format="individual">');
    expect(out).not.toMatch(/format-card[^"]*\b(self|premium)\b/);
    expect(out).not.toContain("data-cw-nav-dark");
  });

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

const priced = `<div class="hero-price"><b data-cw-price-from="way21">4100 грн</b></div>
<!-- cw:formats way21 -->
<!-- cw:format course:way21 --><div class="format-card self"><div class="fc-price">
<b data-cw-price="way21">4100 грн</b><small>повний доступ</small></div><ul class="fc-features"><li>А</li></ul>
<a href="#offer" class="btn btn-primary fc-cta openModal" data-cta-final data-cw-product="way21" data-cw-price-value="4100">Почати Шлях 21</a></div><!-- /cw:format -->
<!-- cw:format way21-group --><div class="format-card self"><div class="fc-price">
<b data-cw-price="way21-group">4100 грн</b><small>повний доступ</small></div><ul class="fc-features"><li>Б</li></ul>
<button type="button" class="btn btn-primary fc-cta" data-lead-open="way21-group">Залишити заявку</button></div><!-- /cw:format -->
<!-- cw:format way21-support --><div class="format-card premium"><div class="fc-price">
<b data-cw-price="way21-support">9000 грн</b><small>розширений доступ</small></div><ul class="fc-features"><li>В</li></ul>
<button type="button" class="btn btn-primary fc-cta" data-lead-open="way21-support">Залишити заявку</button></div><!-- /cw:format -->
<!-- /cw:formats -->`;

describe("landing format sync — one gold button (2026-10-03)", () => {
  const now = new Date("2026-10-03T12:00:00Z");
  const formats = [
    format("course:way21", "self", { amount: 3900 }),
    format("way21-group", "group", { amount: 4100, cohortStartsOn: "2026-11-01" }),
    format("way21-support", "individual", { amount: 9500, mode: "lead" }),
  ];
  const out = applyFormatSync(priced, () => ({ title: "Шлях 21", formats }), now);
  const card = (code: string) => {
    const at = out.indexOf(`cw:format ${code} `);
    return out.slice(at, out.indexOf("/cw:format", at));
  };

  it("gives the gold to the nearest cohort, flags it, and turns the other buttons secondary", () => {
    expect(card("way21-group")).toContain('data-format="group" data-featured>');
    expect(card("way21-group")).toContain('class="btn btn-primary fc-cta');
    expect(card("course:way21")).not.toContain("data-featured");
    expect(card("course:way21")).toContain('class="btn btn-ghost fc-cta openModal"');
    expect(card("way21-support")).toContain('class="btn btn-ghost fc-cta" data-lead-open="way21-support"');
    expect(out.match(/btn-primary fc-cta/g)).toHaveLength(1);
  });

  it("names a generated featured cohort «Найближчий потік»", () => {
    const html = applyFormatSync(page, () => ({ title: "Шлях 21", formats }), now);
    expect(html).toContain('<span class="fc-badge">Найближчий потік</span>');
  });
});

describe("landing format sync — prices and doors (2026-10-03)", () => {
  const formats = [
    format("course:way21", "self", { amount: 3900, mode: "lead" }),
    format("way21-group", "group", { amount: 4100, cohortStartsOn: "2026-11-01" }),
    format("way21-support", "individual", { amount: 9500 }),
  ];
  const out = applyFormatSync(priced, () => ({ title: "Шлях 21", formats }), new Date("2026-10-03T12:00:00Z"));
  const card = (code: string) => {
    const at = out.indexOf(`cw:format ${code} `);
    return out.slice(at, out.indexOf("/cw:format", at));
  };

  it("asks for the program a headline price names", () => {
    expect(collectFormatPrograms('<b data-cw-price-from="way21">1</b>')).toEqual(["way21"]);
  });

  it("prints each card's own figure, an enquiry's quote included, keyed by the format's code", () => {
    expect(card("course:way21")).toContain('<b data-cw-price="course:way21">3900 грн</b>');
    expect(card("way21-support")).toContain('<b data-cw-price="way21-support">9500 грн</b>');
    expect(card("way21-support")).toContain("<small>розширений доступ</small>");
  });

  it("puts a cohort's start in place of the typed note", () => {
    expect(card("way21-group")).toContain("<small>старт потоку 1 листопада · через 29 днів</small>");
  });

  it("gives each card the door its mode asks for", () => {
    // Self went to «заявка»: the checkout becomes the enquiry form.
    expect(card("course:way21")).toContain('data-lead-open="course:way21"');
    expect(card("course:way21")).not.toContain("data-cw-product");
    // Group is a checkout: the enquiry button becomes the checkout.
    expect(card("way21-group")).toContain('data-cw-product="way21-group"');
    expect(card("way21-group")).toContain('data-cw-price-value="4100"');
    expect(card("way21-group")).not.toContain("data-lead-open");
  });

  it("quotes the lowest price across the formats as the headline", () => {
    expect(out).toContain('<b data-cw-price-from="way21">від 3900 грн</b>');
  });

  it("quotes the one price, without «від», for a program with one format", () => {
    const single = applyFormatSync(priced, () => ({
      title: "Шлях 21",
      formats: [format("course:way21", "self", { amount: 3500 })],
    }));
    expect(single).toContain('<b data-cw-price-from="way21">3500 грн</b>');
  });

  it("is stable when synced again, and leaves the headline as typed when formats cannot be read", () => {
    expect(applyFormatSync(out, () => ({ title: "Шлях 21", formats }))).toBe(out);
    expect(applyFormatSync(priced, () => null)).toBe(priced);
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
