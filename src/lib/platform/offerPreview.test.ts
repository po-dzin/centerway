import { describe, expect, it } from "vitest";

import {
  OFFER_CARD_TITLE_MAX,
  OFFER_TITLE_MAX,
  offerCardOverflow,
  offerEyebrow,
  offerName,
  offerSubtitle,
} from "@/lib/platform/offerPreview";

describe("offerName", () => {
  it("drops the explanation hung off the name", () => {
    expect(offerName("Розвантажувальний день — практикум з умовного голодування")).toBe(
      "Розвантажувальний день",
    );
  });

  it("keeps a hyphen that is part of a word", () => {
    // The case that makes a naive split dangerous: cutting here would rename
    // the product to «Short».
    expect(offerName("Short-Перезавантаження")).toBe("Short-Перезавантаження");
  });

  it("accepts an en dash and a spaced hyphen too", () => {
    expect(offerName("Шлях 21 – детокс програма")).toBe("Шлях 21");
    expect(offerName("Шлях 21 - детокс програма")).toBe("Шлях 21");
  });

  it("never answers with nothing", () => {
    // A title that is only a tail is a broken title, not an empty card.
    expect(offerName("— практикум")).toBe("— практикум");
  });

  it("leaves a name with no tail alone", () => {
    expect(offerName("Природнє тіло з Аюрведою")).toBe("Природнє тіло з Аюрведою");
  });
});

describe("offerEyebrow", () => {
  it("is the offer page's badge", () => {
    expect(offerEyebrow("Міні-курс", "3 дні")).toBe("Міні-курс · 3 дні");
  });

  it("prints the kind alone when there is no duration to add", () => {
    expect(offerEyebrow("Міні-курс")).toBe("Міні-курс");
    expect(offerEyebrow("Міні-курс", null)).toBe("Міні-курс");
  });
});

describe("offerSubtitle", () => {
  it("is the half the name gave up", () => {
    expect(offerSubtitle("Розвантажувальний день — практикум з умовного голодування")).toBe(
      "практикум з умовного голодування",
    );
  });

  it("is empty when the title is only a name", () => {
    expect(offerSubtitle("Природнє тіло з Аюрведою")).toBe("");
    expect(offerSubtitle("Short-Перезавантаження")).toBe("");
  });

  it("says nothing for a title that is only a tail", () => {
    // `offerName` keeps such a title whole, so there is no second half to print.
    expect(offerSubtitle("— практикум")).toBe("");
  });
});

describe("offerCardOverflow", () => {
  it("is zero for every name the current catalogue prints", () => {
    // The measured ceiling, and the longest real name sits exactly on it.
    expect(offerCardOverflow("Природнє тіло з Аюрведою")).toBe(0);
    expect(offerCardOverflow("Розвантажувальний день")).toBe(0);
    expect(offerCardOverflow("Short-Перезавантаження")).toBe(0);
  });

  it("counts only the name, never the half after the dash", () => {
    // 57 characters of title, 22 of name: a card pays for none of the tail.
    expect(offerCardOverflow("Розвантажувальний день — практикум з умовного голодування")).toBe(0);
  });

  it("counts how far a genuinely long name runs past two mobile card lines", () => {
    expect(offerCardOverflow("Природнє тіло з Аюрведою для двох і ще для трьох друзів")).toBeGreaterThan(0);
  });

  it("uses one 48-character ceiling for titles and the two-line mobile card", () => {
    expect(OFFER_TITLE_MAX).toBe(48);
    expect(OFFER_CARD_TITLE_MAX).toBe(OFFER_TITLE_MAX);
  });
});
