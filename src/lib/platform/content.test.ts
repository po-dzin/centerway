import { describe, expect, it } from "vitest";

import { LEARNING_SHELF_HREF, learningNavItem, personalNav, platformNav } from "./content";
import manifest from "@/app/manifest";
import { botCopy } from "@/lib/tgSupportBotCopy";

describe("the learning entry", () => {
  it("keeps the public home explicit and the personal bar application-only", () => {
    expect(platformNav[0]).toMatchObject({ label: "Головна", href: "/", match: "exact" });
    expect(personalNav.map((item) => item.label)).toEqual(["Мої курси", "Майстерня"]);
    expect(personalNav.map((item) => item.href)).not.toContain("/");
  });

  it("is not part of the showcase nav", () => {
    // platformNav is addressed to everybody and is identical signed out.
    // Learning exists only if you own something — and then outranks the rest.
    expect(platformNav.map((item) => item.href)).not.toContain(LEARNING_SHELF_HREF);
    expect(platformNav.some((item) => item.label === learningNavItem.label)).toBe(false);
  });

  it("points at the shelf's own route, not at a section of the profile", () => {
    // A hash is not a route: the back button did not step through it, it could
    // not be prefetched, and /learn was missing from a tree that already had
    // /learn/<course>/<lesson>.
    expect(LEARNING_SHELF_HREF).toBe("/learn");
    expect(LEARNING_SHELF_HREF).not.toContain("#");
    expect(learningNavItem.href).toBe(LEARNING_SHELF_HREF);
  });

  /**
   * The places the shelf address appears must not drift apart. Before this
   * constant existed they were separate literals, and the installed app opened
   * on the storefront while the bot sent people to a section of the profile.
   *
   * The start_url is no longer the shelf PATH but the ROOT, and that is the
   * same destination: the installed app lives on the personal host, whose root
   * is rewritten to `/learn`. A relative "/" is the only form that is correct
   * on both hosts this one manifest is served from.
   */
  it("opens the installed app on its own host's root", () => {
    expect(manifest().start_url).toBe("/");
  });

  it("is what the support bot hands people", () => {
    // The bot prints the DESTINATION: on the personal host the dashboard is the
    // root, and `/learn` is a 308 in front of it. A link in a message cannot be
    // corrected later, so it must not name the forward.
    expect(botCopy.cabinet).toContain("https://my.centerway.net.ua/");
    expect(botCopy.cabinet).not.toContain(`${LEARNING_SHELF_HREF}`);
  });

  it("keeps scope at the site root so links out of the shelf stay in the app", () => {
    // A scope narrowed to /profile would kick a programme page out to the
    // browser, mid-session, with no way back into the installed window.
    expect(manifest().scope).toBe("/");
  });

  it("reads as current throughout the course tree", () => {
    // `exact` would leave the entry looking inactive inside every lesson —
    // which is where a learner spends the session.
    expect(learningNavItem.match).toBe("prefix");
  });
});
