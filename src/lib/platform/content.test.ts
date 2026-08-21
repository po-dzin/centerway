import { describe, expect, it } from "vitest";

import { LEARNING_SHELF_HREF, learningNavItem, platformNav } from "./content";
import manifest from "@/app/manifest";
import { botCopy } from "@/lib/tgSupportBotCopy";

describe("the learning entry", () => {
  it("is not part of the showcase nav", () => {
    // platformNav is addressed to everybody and is identical signed out.
    // Learning exists only if you own something — and then outranks the rest.
    expect(platformNav.map((item) => item.href)).not.toContain(LEARNING_SHELF_HREF);
    expect(platformNav.some((item) => item.label === learningNavItem.label)).toBe(false);
  });

  it("points at the cabinet's learning section", () => {
    expect(LEARNING_SHELF_HREF).toBe("/profile#learning");
    expect(learningNavItem.href).toBe(LEARNING_SHELF_HREF);
  });

  /**
   * The four places the shelf address appears must not drift apart. Before this
   * constant existed they were separate literals, and the installed app opened
   * on the storefront while the bot sent people to a section of the profile.
   */
  it("is the installed app's start_url", () => {
    expect(manifest().start_url).toBe(LEARNING_SHELF_HREF);
  });

  it("is what the support bot hands people", () => {
    expect(botCopy.cabinet).toContain(LEARNING_SHELF_HREF);
  });

  it("keeps scope at the site root so links out of the shelf stay in the app", () => {
    // A scope narrowed to /profile would kick a programme page out to the
    // browser, mid-session, with no way back into the installed window.
    expect(manifest().scope).toBe("/");
  });

  it("matches by path, since a hash never appears in a pathname", () => {
    // The header strips the hash before comparing; if the item were declared
    // with `match: "exact"` against the raw href it could never read as current.
    expect(learningNavItem.match).toBe("prefix");
    expect(LEARNING_SHELF_HREF.split("#")[0]).toBe("/profile");
  });
});
