import { describe, expect, it } from "vitest";

import { parseCommentEvents, parsePostbackEvents, signBody, verifySignature } from "./instagram";

const comment = (over: Record<string, unknown> = {}) => ({
  object: "instagram",
  entry: [
    {
      id: "ACCOUNT",
      time: 1_790_000_000,
      changes: [
        {
          field: "comments",
          value: { id: "c1", text: "ДОША", from: { id: "U1", username: "anna" }, media: { id: "M1" }, ...over },
        },
      ],
    },
  ],
});

describe("verifySignature", () => {
  const body = JSON.stringify(comment());

  it("accepts the signature made with the app secret", () => {
    expect(verifySignature("s3cret", body, signBody("s3cret", body))).toBe(true);
  });

  it("refuses a wrong secret, a changed body and a missing header", () => {
    expect(verifySignature("other", body, signBody("s3cret", body))).toBe(false);
    expect(verifySignature("s3cret", body + " ", signBody("s3cret", body))).toBe(false);
    expect(verifySignature("s3cret", body, null)).toBe(false);
    expect(verifySignature("s3cret", body, "sha256=")).toBe(false);
  });
});

describe("parseCommentEvents", () => {
  it("reads a comment with its author and post", () => {
    expect(parseCommentEvents(comment())).toEqual([
      { commentId: "c1", mediaId: "M1", text: "ДОША", fromId: "U1", fromUsername: "anna", time: 1_790_000_000 },
    ]);
  });

  it("skips replies to a comment and the account's own comments", () => {
    expect(parseCommentEvents(comment({ parent_id: "c0" }))).toEqual([]);
    expect(parseCommentEvents(comment({ from: { id: "ACCOUNT", username: "us" } }))).toEqual([]);
  });

  it("ignores other objects, other fields and malformed bodies", () => {
    expect(parseCommentEvents({ object: "page", entry: [] })).toEqual([]);
    expect(parseCommentEvents(null)).toEqual([]);
    expect(
      parseCommentEvents({ object: "instagram", entry: [{ changes: [{ field: "mentions", value: {} }] }] }),
    ).toEqual([]);
    expect(parseCommentEvents(comment({ text: 5 }))).toEqual([]);
  });
});

describe("parsePostbackEvents", () => {
  const tap = (over: Record<string, unknown> = {}) => ({
    object: "instagram",
    entry: [{ id: "ACCOUNT", messaging: [{ sender: { id: "U1" }, postback: { payload: "ar:r1" }, ...over }] }],
  });

  it("reads who tapped and what", () => {
    expect(parsePostbackEvents(tap())).toEqual([{ senderId: "U1", payload: "ar:r1" }]);
  });

  it("skips our own echoes and malformed bodies", () => {
    expect(parsePostbackEvents(tap({ sender: { id: "ACCOUNT" } }))).toEqual([]);
    expect(parsePostbackEvents(tap({ postback: {} }))).toEqual([]);
    expect(parsePostbackEvents(null)).toEqual([]);
  });
});
