import { describe, expect, it } from "vitest";

import {
  countReactions,
  reactionNameIds,
  excerptOf,
  feedFilterQuery,
  feedHeadline,
  feedShareDescription,
  feedShareImage,
  isFeedEmoji,
  isFeedTopic,
  normalizeFeedText,
  normalizeFeedTopics,
  parseFeedFilter,
  visibleReactions,
} from "./model";

describe("feed filter in the address", () => {
  it("reads topics and authors, drops unknown words, sorts to one address", () => {
    const filter = parseFeedFilter({ topic: "relaxation,breathing,announce", author: "evgeniy,Bad Slug,avtor-2" });
    expect(filter).toEqual({ topics: ["breathing", "relaxation"], authors: ["avtor-2", "evgeniy"] });
    expect(feedFilterQuery(filter)).toBe("topic=breathing,relaxation&author=avtor-2,evgeniy");
  });

  it("an empty address is no filter", () => {
    expect(parseFeedFilter({})).toEqual({ topics: [], authors: [] });
    expect(feedFilterQuery({ topics: [], authors: [] })).toBe("");
  });

  it("has no «Анонси» topic", () => {
    expect(isFeedTopic("announce")).toBe(false);
    expect(isFeedTopic("breathing")).toBe(true);
  });
});

describe("feed text", () => {
  it("trims and folds blank lines, refuses empty and too long", () => {
    expect(normalizeFeedText("  a \n\n\n\nb  ", 100)).toBe("a\n\nb");
    expect(normalizeFeedText("   ", 100)).toBeNull();
    expect(normalizeFeedText("x".repeat(101), 100)).toBeNull();
    expect(normalizeFeedText(42, 100)).toBeNull();
  });
});

describe("reactions", () => {
  const rows = [
    { emoji: "heart", auth_user_id: "a" },
    { emoji: "heart", auth_user_id: "b" },
    { emoji: "fire", auth_user_id: "a" },
    { emoji: "fire", auth_user_id: "c" },
    { emoji: "lotus", auth_user_id: "d" },
    { emoji: "sun", auth_user_id: "me" },
    { emoji: "not-an-emoji", auth_user_id: "x" },
  ];

  it("counts per emoji, most used first, ties in the set's order", () => {
    const counts = countReactions(rows, "me");
    expect(counts.map((entry) => [entry.emoji, entry.count])).toEqual([
      ["heart", 2],
      ["fire", 2],
      ["sun", 1],
      ["lotus", 1],
    ]);
  });

  it("shows the top three plus the reader's own", () => {
    const counts = countReactions(
      [...rows, { emoji: "sun", auth_user_id: "z" }, { emoji: "dove", auth_user_id: "me" }],
      "me",
    );
    expect(visibleReactions(counts).map((entry) => entry.emoji)).toEqual(["heart", "fire", "sun", "dove"]);
  });

  it("knows the set", () => {
    expect(isFeedEmoji("moon-dark")).toBe(true);
    expect(isFeedEmoji("grinning")).toBe(false);
  });
});

describe("block excerpt", () => {
  it("keeps short text whole and cuts long text at a word", () => {
    expect(excerptOf("Коротко.")).toBe("Коротко.");
    const long = "слово ".repeat(100);
    const cut = excerptOf(long, 40);
    expect(cut.endsWith("…")).toBe(true);
    expect(cut.length).toBeLessThanOrEqual(41);
    expect(cut).not.toMatch(/\s…$/);
  });
});

describe("topics of a post", () => {
  it("takes one to three known topics in the author's order, without repeats", () => {
    expect(normalizeFeedTopics(["relaxation", "breathing", "relaxation"])).toEqual(["relaxation", "breathing"]);
    expect(normalizeFeedTopics(undefined, "focus")).toEqual(["focus"]);
    expect(normalizeFeedTopics([])).toBeNull();
    expect(normalizeFeedTopics(["focus", "energy", "movement", "nutrition"])).toBeNull();
    expect(normalizeFeedTopics(["focus", "announce"])).toBeNull();
    expect(normalizeFeedTopics(undefined, undefined)).toBeNull();
  });
});

describe("reaction names for the chip hint", () => {
  const rows = [
    { emoji: "heart", auth_user_id: "me" },
    { emoji: "heart", auth_user_id: "u1" },
    { emoji: "heart", auth_user_id: "u2" },
    { emoji: "heart", auth_user_id: "u3" },
    { emoji: "heart", auth_user_id: "u4" },
    { emoji: "thanks", auth_user_id: "u5" },
    { emoji: "calm", auth_user_id: "u6" },
    { emoji: "joy", auth_user_id: "u7" },
  ];

  // Ties keep the set's order: joy, then calm, then thanks — so thanks is fourth.
  it("asks for at most three others per top reaction, never the reader", () => {
    const ids = reactionNameIds(rows, "me");
    expect(ids).toEqual(["u1", "u2", "u3", "u7", "u6"]);
  });

  it("puts names on the top chips only", () => {
    const names = new Map([
      ["u1", "Олена К."],
      ["u2", "Марко Д."],
      ["u3", "Іра"],
      ["u7", "Тарас"],
    ]);
    const counts = countReactions(rows, "me", names);
    expect(counts[0]).toMatchObject({ emoji: "heart", count: 5, mine: true, who: ["Олена К.", "Марко Д.", "Іра"] });
    expect(counts.find((entry) => entry.emoji === "joy")?.who).toEqual(["Тарас"]);
    expect(counts.find((entry) => entry.emoji === "thanks")?.who).toBeUndefined();
  });
});

describe("feedShareImage", () => {
  const photo = (src: string, spoiler = false) => ({ src, w: 1600, h: 900, spoiler });

  it("takes the first photo that is not a spoiler", () => {
    expect(
      feedShareImage({ media: { photos: [photo("a", true), photo("b"), photo("c")], video: null } }),
    ).toMatchObject({
      url: "b",
      width: 1600,
      height: 900,
    });
  });

  it("falls to the video's frame, then to nothing", () => {
    expect(feedShareImage({ media: { photos: [photo("a", true)], video: { youtubeId: "abc123" } } })?.url).toBe(
      "https://i.ytimg.com/vi/abc123/hqdefault.jpg",
    );
    expect(feedShareImage({ media: { photos: [photo("a", true)], video: null } })).toBeNull();
  });
});

it("accepts all three new feed topics in posts and shared filters", () => {
  expect(normalizeFeedTopics(["art", "meaning", "technology"])).toEqual(["art", "meaning", "technology"]);
  expect(feedFilterQuery(parseFeedFilter({ topic: "technology,meaning,art" }))).toBe("topic=art,meaning,technology");
});

describe("shared link headline", () => {
  it("takes a short first line as it is, emoji and capitals included", () => {
    expect(feedHeadline("🔥 ЇСТИ СОЛОДКЕ: ЦЕ РЕАЛЬНО? 🍬\nЗ’їли десерт і відчули провину?")).toEqual({
      title: "🔥 ЇСТИ СОЛОДКЕ: ЦЕ РЕАЛЬНО? 🍬",
      rest: "З’їли десерт і відчули провину?",
    });
  });

  it("takes the first sentence of a long line, keeping the emoji right after its stop", () => {
    const text = `🔥 ЇСТИ СОЛОДКЕ ТА НЕ ГЛАДШАТИ: ЦЕ РЕАЛЬНО? 🍬 З’їли десерт і одразу відчули провину? ${"Далі. ".repeat(10)}`;
    const { title, rest } = feedHeadline(text);
    expect(title).toBe("🔥 ЇСТИ СОЛОДКЕ ТА НЕ ГЛАДШАТИ: ЦЕ РЕАЛЬНО? 🍬");
    expect(rest.startsWith("З’їли десерт")).toBe(true);
  });

  it("cuts a long opening with no early stop at a word", () => {
    const text = "слово ".repeat(40).trim();
    const { title, rest } = feedHeadline(text);
    expect(title.endsWith("слово…")).toBe(true);
    expect(title.length).toBeLessThanOrEqual(91);
    expect(rest.length).toBeGreaterThan(0);
  });

  it("names the author before the words, but not the platform", () => {
    expect(feedShareDescription({ author: { name: "Євгеній", slug: "evgeniy" } }, "Далі текст")).toBe(
      "Євгеній: Далі текст",
    );
    expect(feedShareDescription({ author: { name: "CenterWay", slug: "centerway" } }, "Далі текст")).toBe("Далі текст");
    expect(feedShareDescription({ author: { name: "Євгеній", slug: "evgeniy" } }, "")).toBe("Євгеній");
    expect(feedShareDescription({ author: { name: "CenterWay", slug: "centerway" } }, "Один\n\nДва  три")).toBe(
      "Один\nДва три",
    );
  });
});
