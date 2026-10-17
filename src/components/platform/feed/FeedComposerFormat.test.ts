import { describe, expect, it } from "vitest";

import { parseFeedBody } from "@/lib/feed/format";

import { insertLink, toggleInline, toggleLines } from "./FeedComposerFormat";

describe("toggleInline", () => {
  it("wraps the selection and keeps it selected", () => {
    const edit = toggleInline("Три хвилини дихання", 0, 11, "bold");
    expect(edit.value).toBe("**Три хвилини** дихання");
    expect(edit.value.slice(edit.start, edit.end)).toBe("Три хвилини");
    expect(parseFeedBody(edit.value)[0]).toMatchObject({ t: "p", children: [{ t: "strong" }, { t: "text" }] });
  });

  it("leaves the spaces at the edges outside the markers", () => {
    expect(toggleInline("a слово b", 1, 8, "italic").value).toBe("a *слово* b");
  });

  it("takes the marker off when pressed again", () => {
    const once = toggleInline("слово", 0, 5, "bold");
    const twice = toggleInline(once.value, once.start, once.end, "bold");
    expect(twice.value).toBe("слово");
  });

  it("does not read bold as italic", () => {
    const edit = toggleInline("**слово**", 2, 7, "italic");
    expect(edit.value).toBe("***слово***");
    expect(toggleInline(edit.value, 3, 8, "italic").value).toBe("**слово**");
  });

  it("puts a pair at the caret when nothing is selected", () => {
    const edit = toggleInline("ab", 1, 1, "bold");
    expect(edit.value).toBe("a****b");
    expect(edit.start).toBe(3);
  });
});

describe("insertLink", () => {
  it("links the selected words", () => {
    const edit = insertLink("читайте тут", 8, 11, "https://example.com/");
    expect(edit.value).toBe("читайте [тут](https://example.com/)");
    expect(parseFeedBody(edit.value)[0]).toMatchObject({ children: [{ t: "text" }, { t: "link" }] });
  });

  it("uses the address as the words when nothing is selected", () => {
    expect(insertLink("", 0, 0, "https://a.b/").value).toBe("[https://a.b/](https://a.b/)");
  });
});

describe("toggleLines", () => {
  it("turns the touched lines into a list and back", () => {
    const value = "перше\nдруге\nтретє";
    const edit = toggleLines(value, 2, 8, "ul");
    expect(edit.value).toBe("- перше\n- друге\nтретє");
    expect(toggleLines(edit.value, edit.start, edit.end, "ul").value).toBe(value);
  });

  it("numbers an ordered list", () => {
    expect(toggleLines("а\nб", 0, 3, "ol").value).toBe("1. а\n2. б");
  });

  it("replaces another kind of prefix", () => {
    expect(toggleLines("> цитата", 0, 8, "ul").value).toBe("- цитата");
  });

  it("starts a list on an empty line", () => {
    const edit = toggleLines("", 0, 0, "quote");
    expect(edit.value).toBe("> ");
    expect(edit.start).toBe(2);
  });
});
