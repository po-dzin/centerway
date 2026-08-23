import { describe, expect, it } from "vitest";

import { courseOfferCode, isPublicCourse, parseCourseOfferCode } from "./offers";
import type { Course } from "@/lms-core";

const course = (over: Partial<Course>): Course => ({ status: "published", ...over }) as Course;

describe("course offer codes", () => {
  it("round-trips a slug", () => {
    expect(parseCourseOfferCode(courseOfferCode("way21"))).toBe("way21");
    expect(parseCourseOfferCode(courseOfferCode("reset-day"))).toBe("reset-day");
  });

  it("refuses anything that is not a course code", () => {
    // The hand-written product codes must never resolve through this door.
    expect(parseCourseOfferCode("short")).toBeNull();
    expect(parseCourseOfferCode("way21")).toBeNull();
    expect(parseCourseOfferCode(undefined)).toBeNull();
    expect(parseCourseOfferCode(42)).toBeNull();
  });

  it("refuses a slug that is not slug-shaped, because it becomes a lookup", () => {
    expect(parseCourseOfferCode("course:")).toBeNull();
    expect(parseCourseOfferCode("course:Way21")).toBeNull();
    expect(parseCourseOfferCode("course:a b")).toBeNull();
    expect(parseCourseOfferCode("course:../secret")).toBeNull();
    expect(parseCourseOfferCode("course:-lead")).toBeNull();
    expect(parseCourseOfferCode("course:trail-")).toBeNull();
  });
});

describe("isPublicCourse", () => {
  it("keeps a draft private whatever its visibility claims", () => {
    expect(isPublicCourse(course({ status: "draft", visibility: "listed" }))).toBe(false);
  });

  it("treats a missing visibility as hidden", () => {
    expect(isPublicCourse(course({}))).toBe(false);
  });

  it("lets a published course out only as far as it was told to go", () => {
    expect(isPublicCourse(course({ visibility: "unlisted" }))).toBe(true);
    expect(isPublicCourse(course({ visibility: "listed" }))).toBe(true);
    expect(isPublicCourse(course({ visibility: "hidden" }))).toBe(false);
  });

  it("narrows to the catalogue when asked", () => {
    expect(isPublicCourse(course({ visibility: "unlisted" }), ["listed"])).toBe(false);
    expect(isPublicCourse(course({ visibility: "listed" }), ["listed"])).toBe(true);
  });
});
