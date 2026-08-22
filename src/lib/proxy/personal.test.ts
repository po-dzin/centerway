import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { isPersonalHost, rewritePersonalHostRequest } from "./personal";
import { proxy } from "@/proxy";
import { PERSONAL_HOST } from "@/lib/surfaces/catalog";

function request(host: string, path: string): NextRequest {
  return new NextRequest(new URL(path, `https://${host}`), { headers: { host } });
}

const rewriteOf = (res: { headers: Headers } | null | undefined) =>
  res?.headers.get("x-middleware-rewrite") ?? null;

describe("personal host routing", () => {
  it("recognises the personal host with and without www", () => {
    expect(isPersonalHost(request(PERSONAL_HOST, "/"))).toBe(true);
    expect(isPersonalHost(request(`www.${PERSONAL_HOST}`, "/"))).toBe(true);
    expect(isPersonalHost(request("www.centerway.net.ua", "/"))).toBe(false);
  });

  it("serves the shelf at the root — the installed app's start_url", () => {
    // A REWRITE, not a redirect: a start_url that redirects is one some
    // launchers refuse to treat as in-scope.
    expect(rewriteOf(rewritePersonalHostRequest(request(PERSONAL_HOST, "/")))).toContain("/learn");
  });

  it("passes the builder's own prefix through untouched", () => {
    // `/build` is a real segment here, not a container: `my/build` IS the
    // builder's home, so rewriting it would point at the dashboard.
    for (const path of ["/build", "/build/way21", "/build/way21/day-1"]) {
      expect(rewriteOf(rewritePersonalHostRequest(request(PERSONAL_HOST, path))), path).toBeNull();
    }
  });

  /**
   * The rule that gives each surface ONE canonical origin, applied to both
   * prefixes without exception. A forward for `/learn` would keep an older
   * address alive and discoverable, which is the thing the rule exists to
   * prevent — at the price, stated where it lands, that links printed before
   * the move arrive at a 404.
   */
  it("404s BOTH personal prefixes on the public host and on a funnel host", () => {
    for (const path of ["/learn", "/learn/way21", "/build", "/build/way21"]) {
      expect(rewritePersonalHostRequest(request("www.centerway.net.ua", path))?.status, path).toBe(404);
      expect(rewritePersonalHostRequest(request("way21.centerway.net.ua", path))?.status, path).toBe(404);
    }
  });

  it("has no /learn in its addresses at all — the whole prefix forwards", () => {
    // A dashboard at the root with lessons under `/learn/…` would be children
    // whose parent redirects away. The prefix is the ROUTE, not the address.
    for (const [from, to] of [
      ["/learn?tab=done", "https://my.centerway.net.ua/?tab=done"],
      ["/learn/way21", "https://my.centerway.net.ua/way21"],
      ["/learn/way21/day-1", "https://my.centerway.net.ua/way21/day-1"],
    ] as const) {
      const res = rewritePersonalHostRequest(request(PERSONAL_HOST, from));
      expect(res?.status, from).toBe(308);
      expect(res?.headers.get("location"), from).toBe(to);
    }
  });

  it("serves a lesson at its short address, rewritten onto the route", () => {
    expect(rewriteOf(rewritePersonalHostRequest(request(PERSONAL_HOST, "/way21/day-1")))).toContain(
      "/learn/way21/day-1",
    );
    expect(rewriteOf(rewritePersonalHostRequest(request(PERSONAL_HOST, "/way21")))).toContain("/learn/way21");
  });

  it("forwards a PUBLIC top-level path instead of reading it as a course", () => {
    // On this host an unclaimed path is a course, so `/profile` would resolve
    // as a course that does not exist rather than as the cabinet on `www`.
    const res = rewritePersonalHostRequest(request(PERSONAL_HOST, "/legal/privacy"));
    expect(res?.status).toBe(308);
    expect(res?.headers.get("location")).toBe("https://www.centerway.net.ua/legal/privacy");
  });

  it("leaves every other path on other hosts alone", () => {
    expect(rewritePersonalHostRequest(request("www.centerway.net.ua", "/programs"))).toBeNull();
    expect(rewritePersonalHostRequest(request("way21.centerway.net.ua", "/"))).toBeNull();
  });

  it("keeps both prefixes reachable on localhost and on preview deployments", () => {
    // The subdomain can only ever point at production, so without this the
    // shelf and the builder would be the two surfaces that cannot be opened
    // before they ship.
    for (const host of ["localhost", "centerway-git-branch.vercel.app"]) {
      for (const path of ["/learn/way21", "/build/way21"]) {
        const res = rewritePersonalHostRequest(request(host, path));
        expect(res?.status, `${host}${path}`).not.toBe(404);
        expect(res?.headers.get("location") ?? "", `${host}${path}`).toBe("");
      }
    }
  });

  it("does not mistake a lookalike host for the personal one", () => {
    expect(isPersonalHost(request("my.centerway.net.ua.evil.com", "/"))).toBe(false);
    expect(rewritePersonalHostRequest(request("my.centerway.net.ua.evil.com", "/build"))?.status).toBe(404);
  });
});

/**
 * The unit tests above exercise the personal rule alone, which is why they
 * passed while production 404'd the builder: the bug was in the ORDER the proxy
 * applies its rules, not in the rule. These drive the whole proxy.
 */
describe("personal host, through the full proxy", () => {
  it("routes a lesson path whose first segment is also a product slug", () => {
    // `/way21/` and `/reset-day/` are landing-bundle prefixes, and a course
    // carries its product's slug. The personal prefixes must be decided before
    // the bundle bypass claims the path.
    for (const path of ["/learn/way21/intro", "/build/reset-day/intro"]) {
      const res = proxy(request(PERSONAL_HOST, path));
      expect(rewriteOf(res), path).toBeNull();
      expect(res?.status, path).not.toBe(404);
    }
  });

  it("still lets framework, API and app-metadata paths through on the personal host", () => {
    // The manifest and the icons are generated ROUTES. Without the exact-path
    // bypass they would be swept up by the send-everything-else-to-www rule,
    // which is an installed app that cannot find its own identity.
    for (const path of [
      "/api/lms/authoring/courses",
      "/_next/static/x.js",
      "/favicon.ico",
      "/manifest.webmanifest",
      "/icon.svg",
      "/sw.js",
      "/offline.html",
    ]) {
      const res = proxy(request(PERSONAL_HOST, path));
      expect(rewriteOf(res), path).toBeNull();
      expect(res?.headers.get("location") ?? "", path).toBe("");
    }
  });

  it("leaves the landing bundles alone on their own hosts", () => {
    for (const host of ["way21.centerway.net.ua", "www.centerway.net.ua"]) {
      expect(rewriteOf(proxy(request(host, "/way21/js/common.js"))), host).toBeNull();
    }
  });

  it("keeps /build 404ing on a funnel host", () => {
    expect(proxy(request("way21.centerway.net.ua", "/build"))?.status).toBe(404);
  });

  it("308s www.my to the bare host instead of serving a second copy", () => {
    // isPersonalHost accepts the www form, so without this the environment
    // would answer on two origins — the thing the canonical rule exists to
    // prevent, and the reason the switcher can link with confidence.
    const res = proxy(request(`www.${PERSONAL_HOST}`, "/learn/way21"));
    expect(res?.status).toBe(308);
    expect(res?.headers.get("location")).toBe(`https://${PERSONAL_HOST}/learn/way21`);
  });
});

describe("the platform's own host pair", () => {
  it("308s the apex to www, the host everything else already names", () => {
    // sitemap.ts, robots.ts, metadataBase and WFP_MERCHANT_DOMAIN all say www.
    const res = proxy(request("centerway.net.ua", "/programs"));
    expect(res?.status).toBe(308);
    expect(res?.headers.get("location")).toBe("https://www.centerway.net.ua/programs");
  });

  it("leaves www alone — it is the destination, not a source", () => {
    const res = proxy(request("www.centerway.net.ua", "/programs"));
    expect(res?.status).not.toBe(308);
  });

  it("serves public platform routes on www rather than resolving them as a funnel", () => {
    // Every funnel host is `<product>.centerway.net.ua`, and the registry also
    // registers each one's www form. The platform's own www must not fall into
    // that lookup, or the root would resolve to a brand and serve a landing.
    for (const path of ["/", "/programs", "/profile"]) {
      const res = proxy(request("www.centerway.net.ua", path));
      expect(res?.status, path).not.toBe(404);
      expect(res?.headers.get("location") ?? "", path).not.toContain("centerway.net.ua/way21");
    }
  });

  it("does not drag funnel hosts to www", () => {
    for (const host of ["way21.centerway.net.ua", "irem.centerway.net.ua", PERSONAL_HOST]) {
      const location = proxy(request(host, "/"))?.headers.get("location") ?? "";
      expect(location, host).not.toContain("www.centerway.net.ua");
    }
  });
});
