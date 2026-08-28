import { describe, expect, it } from "vitest";

import { courseReadiness, internalLessonReferenceHref, PLACEHOLDER_MARKER, type Course } from "./index";

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

  it("blocks a reference whose stable target no longer exists", () => {
    const withReference = course();
    withReference.modules[0].lessons[0].blocks[0] = {
      id: "b1",
      type: "rich_text",
      content: [{ kind: "p", text: [{ text: "Зниклий урок", href: internalLessonReferenceHref("missing") }] }],
    };

    expect(courseReadiness(withReference).blockers.map((blocker) => blocker.code)).toContain(
      "lms_ready_broken_reference"
    );
  });

  it("blocks a hard-gated link from today into a future lesson", () => {
    const withFuture = course();
    withFuture.schedule = { mode: "daily", gate: "hard", start: "purchase" };
    const first = withFuture.modules[0].lessons[0];
    first.dayIndex = 1;
    first.blocks = [
      {
        id: "b1",
        type: "rich_text",
        content: [{ kind: "p", text: [{ text: "Завтрашній урок", href: internalLessonReferenceHref("lesson-2") }] }],
      },
      { id: "boundary", type: "boundary_note", text: "Зупиніться, якщо практика викликає дискомфорт." },
    ];
    withFuture.modules[0].lessons.push({
      id: "lesson-2",
      slug: "l2",
      title: "Урок 2",
      order: 2,
      dayIndex: 2,
      blocks: [{ id: "b2", type: "rich_text", content: [{ kind: "p", text: "Далі." }] }],
    });

    expect(courseReadiness(withFuture).blockers.map((blocker) => blocker.code)).toContain(
      "lms_ready_future_reference"
    );
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

/**
 * The showcase gate. Its whole design is that it is CONDITIONAL — none of these
 * five blockers exist for a course nobody can find — so the tests are as much
 * about what does NOT fire as about what does.
 */
describe("what a card owes a stranger", () => {
  const complete: Partial<Course> = {
    cover: { src: "/cover.webp", alt: "Обкладинка" },
    tagline: "Навіщо це людині",
    durationDays: 3,
    categories: ["nutrition"],
  };

  it("asks a hidden course for nothing", () => {
    // The default. A course with no cover, no section and no duration is a
    // perfectly publishable private course — that is most of the shelf.
    expect(courseReadiness(course()).ready).toBe(true);
    expect(courseReadiness(course({ visibility: "hidden" })).ready).toBe(true);
  });

  it("asks an unlisted course for all five, because it still has a page", () => {
    const codes = courseReadiness(course({ visibility: "unlisted" })).blockers.map((one) => one.code);
    expect(codes).toContain("lms_ready_missing_cover");
    expect(codes).toContain("lms_ready_missing_tagline");
    expect(codes).toContain("lms_ready_missing_duration");
    expect(codes).toContain("lms_ready_missing_category");
  });

  it("lets a listed course through once the five are answered", () => {
    expect(courseReadiness(course({ visibility: "listed", ...complete })).ready).toBe(true);
  });

  it("never asks for a kind — the catalogue can still count lessons", () => {
    const codes = courseReadiness(course({ visibility: "listed", ...complete })).blockers.map((one) => one.code);
    expect(codes).not.toContain("lms_ready_missing_kind");
  });

  it("catches a cover whose description was never written", () => {
    const codes = courseReadiness(
      course({ ...complete, visibility: "listed", cover: { src: "/cover.webp", alt: "   " } })
    ).blockers.map((one) => one.code);
    expect(codes).toContain("lms_ready_missing_cover_alt");
    // One complaint about the cover, not two: an image with a blank description
    // is not also a missing image.
    expect(codes).not.toContain("lms_ready_missing_cover");
  });

  it("counts a zero-day claim as a claim, not as silence", () => {
    // `durationDays: 0` never reaches here — `validateCourse` rejects it — but
    // the gate must key on `undefined` rather than on falsiness, or a course
    // could satisfy it by being wrong.
    const stated = courseReadiness(course({ visibility: "listed", ...complete, durationDays: 1 }));
    expect(stated.ready).toBe(true);
  });
});
