import { describe, expect, it } from "vitest";
import {
  consultationBoundary,
  consultationExpectations,
  consultationFaq,
  consultationSteps,
} from "@/components/platform/consultPageContract";

describe("platform consultation page contract", () => {
  it("keeps a complete request-to-plan sequence", () => {
    expect(consultationSteps.map((step) => step.id)).toEqual(["request", "assessment", "plan"]);
    expect(consultationSteps).toHaveLength(3);
  });

  it("states the format, duration and planning horizon", () => {
    const expectations = consultationExpectations.join(" ");
    expect(expectations).toContain("онлайн");
    expect(expectations).toContain("90 хвилин");
    expect(expectations).toContain("2-4 тижні");
  });

  it("keeps the medical boundary visible in both FAQ and boundary copy", () => {
    const medicalAnswer = consultationFaq.find((item) => item.id === "medical")?.answer;
    expect(medicalAnswer).toContain("не замінює");
    expect(consultationBoundary.text).toContain("лікаря");
  });

  it("does not turn every consultation into a course sale", () => {
    const noProgramAnswer = consultationFaq.find((item) => item.id === "no-program")?.answer;
    expect(noProgramAnswer).toContain("не обов’язково продати курс");
  });
});
