import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MARK_MIN_OFFSET_PX,
  clearMark,
  minutesRemaining,
  readMark,
  readScaleId,
  resolveMarkOffset,
  scaleValue,
  writeMark,
  writeScaleId,
} from "./readerSettings";

/** The tests run in node; the reader's storage is the only browser API it touches. */
function installStorage(): Map<string, string> {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
      },
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  });
  return store;
}

describe("reading mark", () => {
  beforeEach(() => {
    installStorage();
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(globalThis, "window");
  });

  it("returns what was written", () => {
    writeMark("way21", "day-3", { y: 1400, h: 5200 });
    expect(readMark("way21", "day-3")).toMatchObject({ y: 1400, h: 5200 });
  });

  it("keeps lessons apart", () => {
    writeMark("way21", "day-3", { y: 1400, h: 5200 });
    expect(readMark("way21", "day-4")).toBeNull();
    expect(readMark("reboot", "day-3")).toBeNull();
  });

  it("ignores a position the reader could reach by opening the page", () => {
    writeMark("way21", "day-3", { y: MARK_MIN_OFFSET_PX - 1, h: 5200 });
    expect(readMark("way21", "day-3")).toBeNull();
  });

  it("forgets a position older than a month", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    writeMark("way21", "day-3", { y: 1400, h: 5200 });
    vi.setSystemTime(new Date("2026-03-01T00:00:00Z"));
    expect(readMark("way21", "day-3")).toBeNull();
  });

  it("survives unreadable storage", () => {
    writeMark("way21", "day-3", { y: 1400, h: 5200 });
    window.localStorage.setItem("cw.reader.pos:way21/day-3", "{not json");
    expect(readMark("way21", "day-3")).toBeNull();
  });

  it("clears", () => {
    writeMark("way21", "day-3", { y: 1400, h: 5200 });
    clearMark("way21", "day-3");
    expect(readMark("way21", "day-3")).toBeNull();
  });
});

describe("resolveMarkOffset", () => {
  it("returns the saved offset when the page is the same height", () => {
    expect(resolveMarkOffset({ y: 1400, h: 5200, at: 0 }, 5200)).toBe(1400);
  });

  it("ignores a reflow small enough to be noise", () => {
    expect(resolveMarkOffset({ y: 1400, h: 5000, at: 0 }, 5200)).toBe(1400);
  });

  it("scales when the document grew — a lazy image landed above the reader", () => {
    expect(resolveMarkOffset({ y: 1400, h: 4000, at: 0 }, 8000)).toBe(2800);
  });

  it("scales when it shrank", () => {
    expect(resolveMarkOffset({ y: 1400, h: 4000, at: 0 }, 2000)).toBe(700);
  });
});

describe("minutesRemaining", () => {
  it("is the whole lesson at the top", () => {
    expect(minutesRemaining(12, 0)).toBe(12);
  });

  it("rounds up, so the number never undersells the read", () => {
    expect(minutesRemaining(12, 0.5)).toBe(6);
    expect(minutesRemaining(12, 0.7)).toBe(4);
  });

  it("never says zero while there is text left", () => {
    expect(minutesRemaining(12, 1)).toBe(1);
  });
});

describe("text size", () => {
  beforeEach(() => {
    installStorage();
  });

  afterEach(() => {
    Reflect.deleteProperty(globalThis, "window");
  });

  it("defaults to the design's own size", () => {
    expect(readScaleId()).toBe("m");
    expect(scaleValue(readScaleId())).toBe(1);
  });

  it("remembers a choice", () => {
    writeScaleId("xl");
    expect(readScaleId()).toBe("xl");
    expect(scaleValue("xl")).toBeGreaterThan(1);
  });

  it("falls back when the stored value is not a step we know", () => {
    window.localStorage.setItem("cw.reader.scale", "huge");
    expect(readScaleId()).toBe("m");
    expect(scaleValue("huge")).toBe(1);
  });
});
