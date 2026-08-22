import { describe, expect, it } from "vitest";

import {
  appHref,
  appIsOffOrigin,
  appsFor,
  currentAppKey,
  hostServesPersonalPath,
  isPersonalHost,
} from "./apps";
import { PERSONAL_HOST } from "@/lib/surfaces/catalog";

const anon = { signedIn: false, role: null, authorsCourses: false };
const learner = { signedIn: true, role: "user", authorsCourses: false };
const author = { signedIn: true, role: "user", authorsCourses: true };
const admin = { signedIn: true, role: "admin", authorsCourses: false };
const support = { signedIn: true, role: "support", authorsCourses: false };

function keys(audience: Parameters<typeof appsFor>[0]) {
  return appsFor(audience).map((app) => app.key);
}

describe("appsFor", () => {
  it("offers nothing to a signed-out visitor", () => {
    // The switcher is an account control, and there is no account.
    expect(appsFor(anon)).toEqual([]);
  });

  it("offers the shelf and the cabinet to any signed-in account", () => {
    // Deliberately NOT gated on owning a course: the header does not fetch per
    // page, and an empty shelf is a working destination.
    expect(keys(learner)).toEqual(["learn", "cabinet"]);
  });

  it("offers the builder to someone who owns a course row", () => {
    expect(keys(author)).toContain("builder");
    expect(keys(author)).not.toContain("admin");
  });

  it("offers the builder and the panel to an admin", () => {
    expect(keys(admin)).toEqual(["learn", "cabinet", "builder", "admin"]);
  });

  it("treats support as staff, same as the nav entry does", () => {
    expect(keys(support)).toContain("admin");
  });

  it("hides the panel while the role is still unresolved", () => {
    // usePlatformRole returns null until it answers. Absent-then-present is the
    // safe order; present-then-gone would blink an entry out mid-read.
    expect(keys({ signedIn: true, role: null, authorsCourses: false })).toEqual(["learn", "cabinet"]);
  });
});

describe("appHref", () => {
  const apps = appsFor(admin);
  const learn = apps.find((a) => a.key === "learn")!;
  const cabinet = apps.find((a) => a.key === "cabinet")!;
  const builder = apps.find((a) => a.key === "builder")!;

  it("names the personal origin for a personal app seen from the showcase", () => {
    // `/learn` and `/build` live on `my` now, so from `www` these must be
    // absolute or the router would look for them on the public host.
    // The shelf's address on `my` is the ROOT, so the switcher names the root.
    expect(appHref(learn, "www.centerway.net.ua")).toBe(`https://${PERSONAL_HOST}/`);
    expect(appHref(builder, "www.centerway.net.ua")).toBe(`https://${PERSONAL_HOST}/build`);
    expect(appIsOffOrigin(learn, "www.centerway.net.ua")).toBe(true);
  });

  it("keeps personal apps relative while already on the personal host", () => {
    // Relative is what keeps a client-side navigation client-side.
    expect(appHref(learn, PERSONAL_HOST)).toBe("/");
    expect(appHref(builder, PERSONAL_HOST)).toBe("/build");
    expect(appIsOffOrigin(builder, PERSONAL_HOST)).toBe(false);
  });

  it("names the platform for a public app seen from the personal host", () => {
    // The crossing goes both ways: the cabinet stayed on `www`.
    expect(appHref(cabinet, PERSONAL_HOST)).toBe("https://www.centerway.net.ua/profile");
    expect(appIsOffOrigin(cabinet, PERSONAL_HOST)).toBe(true);
  });

  it("keeps a public app relative on the public host", () => {
    expect(appHref(cabinet, "www.centerway.net.ua")).toBe("/profile");
    expect(appIsOffOrigin(cabinet, "www.centerway.net.ua")).toBe(false);
  });

  it("stays on paths where no second host exists", () => {
    // The subdomain only ever points at production; absolutising on localhost
    // or a preview would send a developer testing the shelf to the live site.
    for (const host of ["localhost", "127.0.0.1", "cw-git-branch.vercel.app", "localhost:8000"]) {
      expect(appHref(learn, host), host).toBe("/learn");
      expect(appHref(builder, host), host).toBe("/build");
      expect(appHref(cabinet, host), host).toBe("/profile");
    }
  });
});

describe("currentAppKey", () => {
  it("names the application behind a path", () => {
    expect(currentAppKey("my.centerway.net.ua", "/learn")).toBe("learn");
    expect(currentAppKey("my.centerway.net.ua", "/learn/way21/day-1")).toBe("learn");
    expect(currentAppKey("www.centerway.net.ua", "/profile")).toBe("cabinet");
    expect(currentAppKey("www.centerway.net.ua", "/admin/orders")).toBe("admin");
    expect(currentAppKey("localhost", "/build/way21")).toBe("builder");
  });

  it("answers null on a public page", () => {
    // The storefront is not one of the account's applications.
    expect(currentAppKey("www.centerway.net.ua", "/programs/way21")).toBeNull();
    expect(currentAppKey("www.centerway.net.ua", "/")).toBeNull();
  });

  it("reads the personal root as the shelf", () => {
    // `my.…/` is the installed app's start_url and is rewritten to /learn, so
    // the switcher must mark the shelf there rather than nothing.
    expect(currentAppKey("my.centerway.net.ua", "/")).toBe("learn");
    expect(currentAppKey("my.centerway.net.ua", "/build/way21")).toBe("builder");
  });

  it("does not mistake a prefix for a segment", () => {
    expect(currentAppKey("www.centerway.net.ua", "/learning-hub")).toBeNull();
    expect(currentAppKey("www.centerway.net.ua", "/administration")).toBeNull();
  });
});

describe("host predicates", () => {
  it("recognises the personal host and the www form the proxy folds in", () => {
    expect(isPersonalHost(PERSONAL_HOST)).toBe(true);
    expect(isPersonalHost(`www.${PERSONAL_HOST}`)).toBe(true);
    expect(isPersonalHost("www.centerway.net.ua")).toBe(false);
  });

  it("does not mistake a lookalike host for the personal one", () => {
    // A plain endsWith test would hand personal routing to whoever registers a
    // domain ending this way.
    expect(isPersonalHost(`${PERSONAL_HOST}.evil.com`)).toBe(false);
    expect(hostServesPersonalPath("localhost.evil.com")).toBe(false);
  });

  it("serves both families by path where no second host can exist", () => {
    expect(hostServesPersonalPath("localhost")).toBe(true);
    expect(hostServesPersonalPath("127.0.0.1")).toBe(true);
    expect(hostServesPersonalPath("cw-git-branch.vercel.app")).toBe(true);
    expect(hostServesPersonalPath("www.centerway.net.ua")).toBe(false);
  });

  it("treats a missing host as neither", () => {
    expect(isPersonalHost(null)).toBe(false);
    expect(hostServesPersonalPath(undefined)).toBe(false);
  });
});
