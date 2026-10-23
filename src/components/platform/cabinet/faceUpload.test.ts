import { describe, expect, it } from "vitest";

import { STRINGS } from "./authorProfileStrings";
import { faceUploadError } from "./faceUpload";

describe("faceUploadError", () => {
  it("names the three failures a person can fix, and one sentence for the rest", () => {
    expect(faceUploadError(413, "uk")).toBe(STRINGS.uk.uploadTooLarge);
    expect(faceUploadError(415, "uk")).toBe(STRINGS.uk.uploadBadType);
    expect(faceUploadError(429, "en")).toBe(STRINGS.en.uploadTooOften);
    expect(faceUploadError(502, "uk")).toBe(STRINGS.uk.uploadFailed);
    expect(faceUploadError(401, "en")).toBe(STRINGS.en.uploadFailed);
  });
});
