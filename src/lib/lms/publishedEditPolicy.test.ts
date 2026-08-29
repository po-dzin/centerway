import { describe, expect, it } from "vitest";
import { newCourseFromTemplate } from "@/lms-core";
import { immediatePublishedPatch } from "./publishedEditPolicy";

const ids = (() => {
  let index = 0;
  return () => `id-${++index}`;
})();

function publishedCourse() {
  return {
    ...newCourseFromTemplate(ids, { slug: "test-course", title: "Тест", programSlug: "test-course" }),
    status: "published" as const,
  };
}

describe("immediatePublishedPatch", () => {
  it("allows only a cover and the private shelf order to change live", () => {
    const live = publishedCourse();
    expect(immediatePublishedPatch(live, {
      ...live,
      cover: { src: "/cover.jpg", alt: "Обкладинка" },
      sortOrder: 4,
      version: live.version + 1,
    })).toEqual({ cover: { src: "/cover.jpg", alt: "Обкладинка" }, sortOrder: 4, status: "published" });
  });

  it.each([
    ["title", "Нова назва"],
    ["summary", "Новий опис"],
    ["tagline", "Нова обіцянка"],
  ] as const)("sends %s through the reviewable version", (field, value) => {
    const live = publishedCourse();
    expect(immediatePublishedPatch(live, { ...live, [field]: value })).toBeNull();
  });

  it("sends lesson and access changes through the reviewable version", () => {
    const live = publishedCourse();
    const lessonChanged = {
      ...live,
      modules: live.modules.map((module, index) => index === 0
        ? { ...module, lessons: module.lessons.map((lesson, lessonIndex) => lessonIndex === 0 ? { ...lesson, title: "Інший урок" } : lesson) }
        : module),
    };
    expect(immediatePublishedPatch(live, lessonChanged)).toBeNull();
    expect(immediatePublishedPatch(live, { ...live, entitlementProductCodes: [...live.entitlementProductCodes, "new-offer"] })).toBeNull();
  });
});
