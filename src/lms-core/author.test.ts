import { describe, expect, it } from "vitest";

import { authorProfileCompletion, normalizeSocialLink, socialLinkLabel, validateAuthor, type Author } from "./author";

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

describe("social links", () => {
  it("normalises what people paste and refuses what is not an address", () => {
    expect(normalizeSocialLink(" instagram.com/yevhenii ")).toBe("https://instagram.com/yevhenii");
    expect(normalizeSocialLink("http://T.me/centerway")).toBe("https://t.me/centerway");
    expect(normalizeSocialLink("https://www.youtube.com/@cw?si=1")).toBe("https://www.youtube.com/@cw?si=1");
    expect(normalizeSocialLink("@yevhenii")).toBeNull();
    expect(normalizeSocialLink("javascript:alert(1)")).toBeNull();
    expect(normalizeSocialLink("my page")).toBeNull();
    expect(normalizeSocialLink("localhost/x")).toBeNull();
  });

  it("names known networks and falls back to the bare host", () => {
    expect(socialLinkLabel("https://www.instagram.com/x")).toBe("Instagram");
    expect(socialLinkLabel("https://t.me/x")).toBe("Telegram");
    expect(socialLinkLabel("https://youtu.be/x")).toBe("YouTube");
    expect(socialLinkLabel("https://www.threads.net/@x")).toBe("Threads");
    expect(socialLinkLabel("https://www.centerway.net.ua/expert/x")).toBe("centerway.net.ua");
  });

  it("accepts up to six normalised links and nothing else", () => {
    expect(() => validateAuthor({ ...base, socialLinks: ["https://t.me/x"] })).not.toThrow();
    expect(() => validateAuthor({ ...base, socialLinks: ["t.me/x"] })).toThrow("lms_author_invalid_social_links");
    expect(() => validateAuthor({ ...base, socialLinks: [] })).toThrow("lms_author_invalid_social_links");
    expect(() =>
      validateAuthor({ ...base, socialLinks: Array.from({ length: 7 }, (_, i) => `https://site${i}.com`) }),
    ).toThrow("lms_author_invalid_social_links");
  });
});
