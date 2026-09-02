import { describe, expect, it } from "vitest";

import { authorProfileCompletion, validateAuthor, type Author } from "./author";

const base: Author = { id: "author-1", slug: "author", name: "Автор" };

describe("authorProfileCompletion", () => {
  it("counts the shared profile fields and keeps publishing optional", () => {
    expect(authorProfileCompletion(base)).toEqual({ completed: 1, total: 10, percent: 10 });

    const complete: Author = {
      ...base,
      role: "Провідник",
      bio: "Біографія",
      quote: "Цитата",
      credentials: ["Освіта"],
      facts: ["1", "2", "3", "4", "5", "6"],
      profileBlocks: [{ id: "path", kind: "text", title: "Шлях", body: "Історія" }],
      experienceBadge: "12 років практики",
      achievementBadge: "Засновник CenterWay",
      photo: { src: "/author.jpg", alt: "Автор" },
      listed: false,
    };

    expect(authorProfileCompletion(complete)).toEqual({ completed: 10, total: 10, percent: 100 });
  });
});

describe("validateAuthor", () => {
  it("accepts a photo crop within 0-100 on both frames", () => {
    const author: Author = {
      ...base,
      photo: { src: "/author.jpg", alt: "Автор", cropX: 50, cropY: 22, avatarCropX: 40, avatarCropY: 60 },
    };
    expect(() => validateAuthor(author)).not.toThrow();
  });

  it("rejects a crop value outside 0-100", () => {
    const author = { ...base, photo: { src: "/author.jpg", alt: "Автор", cropY: 140 } };
    expect(() => validateAuthor(author)).toThrow("lms_author_invalid_photo_cropY");
  });
});
