import { describe, expect, it } from "vitest";

import { courseReadiness, type Course } from "./index";

function course(overrides: Partial<Course> = {}): Course {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    slug: "demo",
    title: "Demo",
    programSlug: "demo",
    brand: "centerway",
    locale: "uk",
    translationGroupId: "demo",
    status: "draft",
    version: 1,
    schedule: { mode: "open" },
    entitlementProductCodes: ["demo"],
    modules: [
      {
        id: "00000000-0000-4000-8000-000000000011",
        slug: "m1",
        title: "Module",
        order: 1,
        lessons: [
          {
            id: "00000000-0000-4000-8000-000000000101",
            slug: "l1",
            title: "Lesson",
            order: 1,
            blocks: [{ id: "b1", type: "rich_text", content: [{ kind: "p", text: "Готовий текст." }] }],
          },
        ],
      },
    ],
    ...overrides,
  };
}

describe("courseReadiness", () => {
  it("passes a course with no holes", () => {
    expect(courseReadiness(course()).ready).toBe(true);
  });

  it("blocks on an authoring marker, wherever it hides", () => {
    const withMarker = course();
    withMarker.modules[0].lessons[0].blocks.push({
      id: "b2",
      type: "checklist",
      items: [{ id: "c1", text: "[ЗАПОВНИ: пункт чек-листа]" }],
    });

    const readiness = courseReadiness(withMarker);
    expect(readiness.ready).toBe(false);
    expect(readiness.blockers[0].code).toBe("lms_ready_placeholder");
  });

  it("blocks on a video block whose id was never filled in", () => {
    const withVideo = course();
    withVideo.modules[0].lessons[0].blocks = [
      { id: "b1", type: "video", provider: "youtube", videoId: "[ЗАПОВНИ: id]" },
    ];

    const codes = courseReadiness(withVideo).blockers.map((blocker) => blocker.code);
    expect(codes).toContain("lms_ready_invalid_video_id");
  });

  it("blocks on a CTA that points nowhere", () => {
    const withCta = course();
    withCta.modules[0].lessons[0].blocks.push({
      id: "b2",
      type: "cta",
      label: "Приєднатися",
      href: "todo",
    });

    const codes = courseReadiness(withCta).blockers.map((blocker) => blocker.code);
    expect(codes).toContain("lms_ready_invalid_href");
  });

  it("demands a boundary note from any protocol that touches the body", () => {
    const protocol = course();
    protocol.modules[0].lessons[0].blocks = [
      { id: "b1", type: "practice_block", title: "Дихальна практика" },
    ];

    const codes = courseReadiness(protocol).blockers.map((blocker) => blocker.code);
    expect(codes).toContain("lms_ready_missing_boundary");
  });

  it("accepts the same protocol once its limit is stated", () => {
    const protocol = course();
    protocol.modules[0].lessons[0].blocks = [
      { id: "b1", type: "practice_block", title: "Дихальна практика" },
      { id: "b2", type: "boundary_note", text: "Практика доповнює, а не замінює лікування." },
    ];

    expect(courseReadiness(protocol).ready).toBe(true);
  });
});
