import { describe, expect, it } from "vitest";

import { isPersonalHost, resolveSurfaceHref, servesEveryPath } from "./surfaceHref";

const WWW = "www.centerway.net.ua";
const MY = "my.centerway.net.ua";

describe("resolveSurfaceHref", () => {
  it("keeps a link relative when the current origin owns the path", () => {
    // Relative is what keeps a client-side navigation client-side.
    expect(resolveSurfaceHref("/programs", WWW)).toBe("/programs");
    expect(resolveSurfaceHref("/profile", WWW)).toBe("/profile");
    expect(resolveSurfaceHref("/learn", MY)).toBe("/");
    // The learner tree loses its prefix entirely — that is the address on `my`.
    expect(resolveSurfaceHref("/learn/way21/day-1", MY)).toBe("/way21/day-1");
    expect(resolveSurfaceHref("/build/way21", MY)).toBe("/build/way21");
  });

  it("names the other origin when the link crosses the public/personal line", () => {
    // The bare shelf path folds to the personal ROOT — that is where it answers
    // now, and a link should name the destination, not the 308 in front of it.
    expect(resolveSurfaceHref("/learn", WWW)).toBe("https://my.centerway.net.ua/");
    expect(resolveSurfaceHref("/build", WWW)).toBe("https://my.centerway.net.ua/build");
    expect(resolveSurfaceHref("/profile", MY)).toBe("https://www.centerway.net.ua/profile");
    expect(resolveSurfaceHref("/", MY)).toBe("https://www.centerway.net.ua/");
  });

  it("absolutises public links on a funnel host, as it always did", () => {
    // Those hosts are served by this same app through the proxy, so a relative
    // link there resolves to a landing 404.
    expect(resolveSurfaceHref("/programs", "way21.centerway.net.ua")).toBe(
      "https://www.centerway.net.ua/programs",
    );
  });

  it("leaves everything on paths where no second host exists", () => {
    // The subdomain only ever points at production; absolutising on localhost
    // or a preview would send a developer testing the shelf to the live site.
    // `/learn` stays itself there too: on those hosts the ROOT is the
    // storefront, so folding the shelf into it would point at the wrong page.
    for (const host of ["localhost", "localhost:8000", "127.0.0.1", "cw-git-x.vercel.app"]) {
      expect(resolveSurfaceHref("/learn", host), host).toBe("/learn");
      expect(resolveSurfaceHref("/profile", host), host).toBe("/profile");
    }
  });

  it("passes an absolute href through untouched", () => {
    expect(resolveSurfaceHref("https://telegram.me/x", MY)).toBe("https://telegram.me/x");
  });

  it("matches personal prefixes by SEGMENT, not by string prefix", () => {
    // `/learning-hub` is a public page and must not be dragged to `my`.
    expect(resolveSurfaceHref("/learning-hub", WWW)).toBe("/learning-hub");
    expect(resolveSurfaceHref("/builder-notes", WWW)).toBe("/builder-notes");
  });

  it("carries the query and hash across the crossing", () => {
    expect(resolveSurfaceHref("/learn/way21?day=3#top", WWW)).toBe(
      "https://my.centerway.net.ua/way21?day=3#top",
    );
  });
});

describe("host predicates", () => {
  it("accepts the www form of the personal host, which the proxy folds in", () => {
    expect(isPersonalHost(MY)).toBe(true);
    expect(isPersonalHost(`www.${MY}`)).toBe(true);
    expect(isPersonalHost("my.centerway.net.ua:443")).toBe(true);
  });

  it("does not mistake a lookalike host for the personal one", () => {
    expect(isPersonalHost("my.centerway.net.ua.evil.com")).toBe(false);
    expect(isPersonalHost(null)).toBe(false);
    expect(servesEveryPath("localhost.evil.com")).toBe(false);
  });
});
