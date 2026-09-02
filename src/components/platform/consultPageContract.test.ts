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
    // Case-insensitive on the format word: the list is set in sentence case
    // like every other list on the platform, so «Онлайн-зустріч» is the same
    // promise «онлайн» was. The two figures below are numbers and stay exact.
    const expectations = consultationExpectations.join(" ");
    expect(expectations.toLowerCase()).toContain("онлайн");
    expect(expectations).toContain("90 хвилин");
    expect(expectations).toContain("2-4 тижні");
  });

  /* The lists on this page are sentences, so they open like sentences. They
     used to start lowercase and run on with no full stop, which read as a
     dropdown's options rather than as the page talking. */
  it("sets every expectation as a sentence", () => {
    for (const line of consultationExpectations) {
      expect(line[0]).toBe(line[0].toUpperCase());
    }
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
