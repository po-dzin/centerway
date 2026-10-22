import { describe, expect, it } from "vitest";

import { poseFor } from "./ProgressRail";

describe("poseFor", () => {
  it("opens and closes the salutation in pranamasana", () => {
    expect(poseFor(0, 11)).toBe("pose-pranam");
    expect(poseFor(10, 11)).toBe("pose-hasta");
    expect(poseFor(23, 24)).toBe("pose-pranam");
  });

  it("sits a finished course in lotus", () => {
    expect(poseFor(11, 11)).toBe("pose-lotus");
    expect(poseFor(24, 24)).toBe("pose-lotus");
  });

  it("walks one circle whatever the length", () => {
    expect(poseFor(6, 12)).toBe("pose-cobra");
    expect(poseFor(4, 12)).toBe("pose-dog");
    expect(poseFor(12, 24)).toBe("pose-cobra");
  });
});
