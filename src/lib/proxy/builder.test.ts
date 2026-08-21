import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { isBuilderHost, rewriteBuilderHostRequest } from "./builder";
import { proxy } from "@/proxy";
import { BUILDER_HOST } from "@/lib/surfaces/catalog";

function request(host: string, path: string): NextRequest {
  return new NextRequest(new URL(path, `https://${host}`), { headers: { host } });
}

describe("builder host routing", () => {
  it("recognises the builder host with and without www", () => {
    expect(isBuilderHost(request(BUILDER_HOST, "/"))).toBe(true);
    expect(isBuilderHost(request(`www.${BUILDER_HOST}`, "/"))).toBe(true);
    expect(isBuilderHost(request("www.centerway.net.ua", "/"))).toBe(false);
  });

  it("maps the builder host's root onto the course list", () => {
    const response = rewriteBuilderHostRequest(request(BUILDER_HOST, "/"));
    expect(response?.headers.get("x-middleware-rewrite")).toContain("/build");
  });

  it("maps a deep path on the builder host onto the same path under /build", () => {
    const response = rewriteBuilderHostRequest(request(BUILDER_HOST, "/way21/day-1"));
    expect(response?.headers.get("x-middleware-rewrite")).toContain("/build/way21/day-1");
  });

  it("passes an already-rewritten path through instead of recursing", () => {
    const response = rewriteBuilderHostRequest(request(BUILDER_HOST, "/build/way21"));
    expect(response?.headers.get("x-middleware-rewrite")).toBeNull();
  });

  /**
   * The rule that gives the builder ONE canonical origin.
   *
   * Without it the builder answers on the platform domain too — wearing the
   * platform's header and footer — and that is the URL links, search engines
   * and muscle memory would find first.
   */
  it("404s the /build prefix on the platform host", () => {
    expect(rewriteBuilderHostRequest(request("www.centerway.net.ua", "/build"))?.status).toBe(404);
    expect(rewriteBuilderHostRequest(request("www.centerway.net.ua", "/build/way21"))?.status).toBe(404);
  });

  it("404s the prefix on a funnel host too", () => {
    expect(rewriteBuilderHostRequest(request("way21.centerway.net.ua", "/build"))?.status).toBe(404);
  });

  it("leaves every other path on other hosts alone", () => {
    expect(rewriteBuilderHostRequest(request("www.centerway.net.ua", "/learn/way21"))).toBeNull();
    expect(rewriteBuilderHostRequest(request("way21.centerway.net.ua", "/"))).toBeNull();
  });

  it("keeps the prefix reachable on localhost and on preview deployments", () => {
    // The subdomain can only ever point at production, so without this the
    // builder would be the one surface that cannot be opened before it ships.
    expect(rewriteBuilderHostRequest(request("localhost", "/build"))?.status).not.toBe(404);
    expect(rewriteBuilderHostRequest(request("centerway-git-branch.vercel.app", "/build"))?.status).not.toBe(404);
  });

  it("does not mistake a lookalike host for the builder", () => {
    expect(isBuilderHost(request("build.centerway.net.ua.evil.com", "/"))).toBe(false);
    expect(rewriteBuilderHostRequest(request("build.centerway.net.ua.evil.com", "/build"))?.status).toBe(404);
  });
});

/**
 * The unit tests above exercise the builder rule alone, which is why they all
 * passed while production 404'd: the bug was in the ORDER the proxy applies its
 * rules, not in the rule. These drive the whole proxy.
 */
describe("builder host, through the full proxy", () => {
  const rewriteOf = (res: ReturnType<typeof proxy>) => res?.headers.get("x-middleware-rewrite") ?? null;

  it("routes a lesson path whose first segment is also a product slug", () => {
    // The shipped bug. `/way21/` and `/reset-day/` are landing-bundle prefixes,
    // and a course carries its product's slug, so every lesson-editor URL was
    // bypassed to the static bundle and 404'd.
    for (const path of ["/way21/intro", "/reset-day/intro", "/irem/x"]) {
      const res = proxy(request(BUILDER_HOST, path));
      expect(rewriteOf(res), path).toContain(`/build${path}`);
    }
  });

  it("routes a course path and the root", () => {
    expect(rewriteOf(proxy(request(BUILDER_HOST, "/way21")))).toContain("/build/way21");
    expect(rewriteOf(proxy(request(BUILDER_HOST, "/")))).toContain("/build");
  });

  it("still lets framework and API paths through untouched on the builder host", () => {
    for (const path of ["/api/lms/authoring/courses", "/_next/static/x.js", "/favicon.ico"]) {
      expect(rewriteOf(proxy(request(BUILDER_HOST, path))), path).toBeNull();
    }
  });

  it("leaves the landing bundles alone on their own hosts", () => {
    // The reordering must not steal static landing paths from funnel hosts.
    for (const host of ["way21.centerway.net.ua", "www.centerway.net.ua"]) {
      const res = proxy(request(host, "/way21/js/common.js"));
      expect(rewriteOf(res), host).toBeNull();
    }
  });

  it("keeps /build 404ing on a funnel host", () => {
    expect(proxy(request("way21.centerway.net.ua", "/build"))?.status).toBe(404);
  });

  it("308s www.build to the bare host instead of serving a second copy", () => {
    // isBuilderHost accepts the www form, so without this the builder would
    // answer on two origins — the thing the /build 404 rule exists to prevent.
    const res = proxy(request(`www.${BUILDER_HOST}`, "/way21/intro"));
    expect(res?.status).toBe(308);
    expect(res?.headers.get("location")).toBe(`https://${BUILDER_HOST}/way21/intro`);
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
    // The funnel rule redirects www→bare. The platform's direction is the
    // opposite, so www must not be caught by it and bounced to the apex.
    const res = proxy(request("www.centerway.net.ua", "/programs"));
    expect(res?.status).not.toBe(308);
  });

  it("serves platform routes on www rather than resolving it as a funnel", () => {
    // Every funnel host is `<product>.centerway.net.ua`, and the registry also
    // registers each one's www form. The platform's own www must not fall into
    // that lookup, or the root would resolve to a brand and serve a landing.
    for (const path of ["/", "/programs", "/profile", "/learn/way21"]) {
      const res = proxy(request("www.centerway.net.ua", path));
      expect(res?.status, path).not.toBe(404);
      expect(res?.headers.get("location") ?? "", path).not.toContain("centerway.net.ua/way21");
    }
  });

  it("does not drag funnel hosts to www", () => {
    // Every funnel host ends in centerway.net.ua; only an exact apex match may
    // redirect, or way21.centerway.net.ua would land on www.
    for (const host of ["way21.centerway.net.ua", "irem.centerway.net.ua", BUILDER_HOST]) {
      const location = proxy(request(host, "/"))?.headers.get("location") ?? "";
      expect(location, host).not.toContain("www.centerway.net.ua");
    }
  });
});
