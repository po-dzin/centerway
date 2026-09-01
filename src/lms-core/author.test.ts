import { describe, expect, it } from "vitest";

import { authorProfileCompletion, type Author } from "./author";

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
