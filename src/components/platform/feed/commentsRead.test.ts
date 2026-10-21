import { describe, expect, it } from "vitest";

import { commentsAfterRead } from "./commentsRead";

type C = { id: string; held?: boolean };
const two: C[] = [{ id: "a" }, { id: "b", held: true }];

describe("commentsAfterRead", () => {
  it("shows what a successful read returns", () => {
    expect(commentsAfterRead<C>(null, { ok: true, comments: two }, true)).toEqual(two);
    expect(commentsAfterRead<C>(two, { ok: true, comments: [] }, false)).toEqual([]);
  });

  it("never turns a failed first read into an empty thread (the «0» bug)", () => {
    expect(commentsAfterRead<C>(null, { ok: false }, true)).toBeNull();
    expect(commentsAfterRead<C>(null, { ok: false }, false)).toBeNull();
  });

  it("keeps what is shown when a later read fails", () => {
    expect(commentsAfterRead<C>(two, { ok: false }, true)).toEqual(two);
  });

  it("drops the reader's own held comments once they are signed out", () => {
    expect(commentsAfterRead<C>(two, { ok: false }, false)).toEqual([{ id: "a" }]);
  });
});
