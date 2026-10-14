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

  it("accepts a gallery of photographs and YouTube videos", () => {
    const author: Author = {
      ...base,
      gallery: [
        { id: "g1", kind: "image", src: "/work.jpg", alt: "Практика в залі", caption: "Ранкова група" },
        { id: "g2", kind: "video", provider: "youtube", videoId: "6jmhNMj_Duo" },
      ],
    };
    expect(() => validateAuthor(author)).not.toThrow();
  });

  it("rejects a gallery photograph without a description", () => {
    const author = { ...base, gallery: [{ id: "g1", kind: "image", src: "/work.jpg", alt: "" }] };
    expect(() => validateAuthor(author)).toThrow("lms_author_gallery_item_missing_alt");
  });

  it("rejects a gallery video that is not a YouTube id", () => {
    const author = {
      ...base,
      gallery: [{ id: "g1", kind: "video", provider: "youtube", videoId: "https://vimeo.com/1" }],
    };
    expect(() => validateAuthor(author)).toThrow("lms_author_gallery_item_invalid_video");
  });
});
