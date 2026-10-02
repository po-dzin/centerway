import { beforeEach, describe, expect, it } from "vitest";

import { KEPT_RESULT_TTL_MS, keepResult, leadSentences, markResultClaimed, readKeptResult } from "./keptResult";

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
}

beforeEach(() => {
  (globalThis as { window?: unknown }).window = { localStorage: new MemoryStorage() };
});

describe("kept result", () => {
  it("reads back what was kept, unclaimed until marked", () => {
    keepResult("k", { type: "vata" }, false, 1000);
    expect(readKeptResult("k", 2000)).toEqual({ savedAt: 1000, claimed: false, result: { type: "vata" } });
    markResultClaimed("k", 2000);
    expect(readKeptResult("k", 2000)?.claimed).toBe(true);
    expect(readKeptResult("k", 2000)?.savedAt).toBe(1000);
  });

  it("forgets a result older than a day", () => {
    keepResult("k", { type: "vata" }, false, 0);
    expect(readKeptResult("k", KEPT_RESULT_TTL_MS + 1)).toBeNull();
    expect(readKeptResult("k", 1)).toBeNull();
  });

  it("returns null without storage instead of throwing", () => {
    (globalThis as { window?: unknown }).window = undefined;
    expect(readKeptResult("k")).toBeNull();
    expect(() => keepResult("k", 1, false)).not.toThrow();
  });
});

describe("leadSentences", () => {
  it("never cuts inside a sentence", () => {
    const text = "Перше речення тут. Друге речення трохи довше за перше! Третє.";
    expect(leadSentences(text, 20)).toBe("Перше речення тут.");
    expect(leadSentences(text, 60)).toBe("Перше речення тут. Друге речення трохи довше за перше!");
  });

  it("keeps a closing quote with its sentence and returns a single long sentence whole", () => {
    expect(leadSentences("«Як туман над водою.» Далі.", 22)).toBe("«Як туман над водою.»");
    const long = "Одне дуже довге речення без жодної крапки всередині нього";
    expect(leadSentences(long, 10)).toBe(long);
  });
});
