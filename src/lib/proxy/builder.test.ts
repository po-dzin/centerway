import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { isBuilderHost, rewriteBuilderHostRequest } from "./builder";
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
