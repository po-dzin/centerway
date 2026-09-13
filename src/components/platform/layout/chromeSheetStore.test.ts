import { describe, expect, it, vi } from "vitest";

import { closeOtherSheets, registerOpenSheet } from "./chromeSheetStore";

/* The burger and the avatar hand the open state over instead of dropping it:
   the sheet that opens closes its siblings in its own handler. These pin the
   registry that makes that possible. */
describe("chrome sheet handoff", () => {
  it("closes every other open sheet and leaves the opener alone", () => {
    const burger = Symbol("burger");
    const avatar = Symbol("avatar");
    const closeBurger = vi.fn();
    const closeAvatar = vi.fn();
    const releaseBurger = registerOpenSheet(burger, closeBurger);
    const releaseAvatar = registerOpenSheet(avatar, closeAvatar);

    expect(closeOtherSheets(avatar)).toBe(true);
    expect(closeBurger).toHaveBeenCalledTimes(1);
    expect(closeAvatar).not.toHaveBeenCalled();

    releaseBurger();
    releaseAvatar();
  });

  it("reports that nothing was handed over when no sibling is open", () => {
    const only = Symbol("only");
    const release = registerOpenSheet(only, vi.fn());

    expect(closeOtherSheets(only)).toBe(false);
    expect(closeOtherSheets(Symbol("fresh"))).toBe(true);

    release();
    expect(closeOtherSheets(Symbol("fresh"))).toBe(false);
  });

  it("a stale release does not unregister a sheet that re-opened", () => {
    const sheet = Symbol("sheet");
    const firstClose = vi.fn();
    const secondClose = vi.fn();
    const releaseFirst = registerOpenSheet(sheet, firstClose);
    const releaseSecond = registerOpenSheet(sheet, secondClose);

    releaseFirst();
    closeOtherSheets(Symbol("other"));
    expect(secondClose).toHaveBeenCalledTimes(1);
    expect(firstClose).not.toHaveBeenCalled();

    releaseSecond();
  });
});
