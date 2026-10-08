import { describe, expect, it } from "vitest";
import { pencilPressure } from "./pencil";

describe("physical pencil pressure", () => {
  it("closes a perimeter without a jump in pigment width", () => {
    for (const phase of [0, 0.7, 3, 6]) {
      expect(pencilPressure(0, phase, true)).toBeCloseTo(pencilPressure(1, phase, true), 10);
      expect(Math.abs(pencilPressure(0.999, phase, true) - pencilPressure(0, phase, true))).toBeLessThan(0.005);
    }
  });
  it("keeps the contour visible with fine open tips", () => {
    for (const phase of [0, 0.7, 3, 6]) {
      for (let i = 0; i <= 100; i++) {
        const width = pencilPressure(i / 100, phase);
        expect(width).toBeGreaterThan(0.19);
        expect(width).toBeLessThan(1.25);
      }
      expect(pencilPressure(0, phase)).toBeLessThan(pencilPressure(0.5, phase));
      expect(pencilPressure(1, phase)).toBeLessThan(pencilPressure(0.5, phase));
    }
  });
});
