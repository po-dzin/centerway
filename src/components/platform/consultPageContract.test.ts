import { describe, expect, it } from "vitest";
import {
  consultationBoundary,
  consultationFaq,
  consultationHubSteps,
  consultationSteps,
} from "@/components/platform/consultPageContract";

describe("platform consultation page contract", () => {
  it("keeps a complete request-to-plan sequence on the author's page", () => {
    expect(consultationSteps.map((step) => step.id)).toEqual(["request", "time", "plan"]);
  });

  /* The hub has no form, so its sequence starts one step earlier — with
     choosing the person — and sends the request to that person's page. */
  it("starts the hub's sequence with choosing an author", () => {
    expect(consultationHubSteps.map((step) => step.id)).toEqual(["choose", "request", "plan"]);
    expect(consultationHubSteps[1].title).toContain("сторінці автора");
  });

  it("keeps the planning horizon in both sequences", () => {
    expect(consultationSteps.at(-1)?.text).toContain("2–4 тижні");
    expect(consultationHubSteps.at(-1)?.text).toContain("2–4 тижні");
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
