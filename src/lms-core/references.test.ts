import { describe, expect, it } from "vitest";

import {
  buildInternalReferenceTargets,
  internalBlockReferenceHref,
  internalLessonReferenceHref,
  parseInternalReference,
  type Course,
} from "./index";

const course = (): Course => ({
  id: "course",
  slug: "course-address",
  title: "Курс",
  programSlug: "course",
  brand: "centerway",
  locale: "uk",
  translationGroupId: "course",
  status: "draft",
  version: 1,
  schedule: { mode: "open" },
  entitlementProductCodes: [],
  modules: [{
    id: "module",
    slug: "module",
    title: "Модуль",
    order: 1,
    lessons: [{
      id: "lesson-stable-id",
      slug: "mutable-slug",
      title: "Нова назва уроку",
      order: 1,
      blocks: [{ id: "practice-stable-id", type: "practice_block", title: "Дихання" }],
    }],
  }],
});

describe("internal references", () => {
  it("stores stable entity identities rather than mutable routes", () => {
    expect(parseInternalReference(internalLessonReferenceHref("lesson-stable-id"))).toEqual({
      kind: "lesson",
      lessonId: "lesson-stable-id",
    });
    expect(parseInternalReference(internalBlockReferenceHref("lesson-stable-id", "practice-stable-id"))).toEqual({
      kind: "block",
      lessonId: "lesson-stable-id",
      blockId: "practice-stable-id",
    });
  });

  it("resolves the current slug and label from the course", () => {
    const targets = buildInternalReferenceTargets(course());
    expect(targets.find((target) => target.kind === "lesson")).toMatchObject({
      key: internalLessonReferenceHref("lesson-stable-id"),
      slug: "mutable-slug",
      label: "Нова назва уроку",
    });
    expect(targets.find((target) => target.kind === "block")).toMatchObject({
      key: internalBlockReferenceHref("lesson-stable-id", "practice-stable-id"),
      label: "Практика: Дихання",
    });
  });
});
