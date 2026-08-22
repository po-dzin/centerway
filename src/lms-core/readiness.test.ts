import { describe, expect, it } from "vitest";

import { courseReadiness, PLACEHOLDER_MARKER, type Course } from "./index";

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

describe("table blocks", () => {
  it("counts a marker inside a cell as a blocker", () => {
    // Every author-visible string of every block type has to be scanned. A type
    // missing from `blockText` is the quietest way for readiness to be wrong:
    // the course publishes with a hole nobody was told about.
    const course = tableCourse([["Ранок", `${PLACEHOLDER_MARKER}: доза]`]]);
    expect(courseReadiness(course).blockers.some((b) => b.code === "lms_ready_placeholder")).toBe(true);
  });

  it("is ready when every cell is filled", () => {
    const course = tableCourse([["Ранок", "1 ложка"]]);
    expect(courseReadiness(course).ready).toBe(true);
  });
});

function tableCourse(rows: string[][]): Course {
  return {
    id: "c",
    slug: "tables",
    title: "Таблиці",
    programSlug: "way21",
    brand: "centerway",
    locale: "uk",
    translationGroupId: "g",
    status: "draft",
    version: 1,
    schedule: { mode: "open" },
    entitlementProductCodes: [],
    modules: [
      {
        id: "m",
        slug: "m",
        title: "Модуль",
        order: 1,
        lessons: [
          {
            id: "l",
            slug: "l",
            title: "Урок",
            order: 1,
            blocks: [{ id: "b", type: "table", head: ["Коли", "Скільки"], rows }],
          },
        ],
      },
    ],
  };
}
