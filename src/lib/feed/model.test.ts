import { describe, expect, it } from "vitest";

import {
  countReactions,
  reactionNameIds,
  excerptOf,
  feedFilterQuery,
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
