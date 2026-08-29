import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import { isPlatformEscapePath } from "./platformEscape";
import { rewriteFunnelHostRequest } from "./landing";

function request(host: string, path: string): NextRequest {
  return new NextRequest(new URL(path, `https://${host}`), { headers: { host } });
}

describe("platform routes on a funnel host", () => {
  it("recognises account paths and only those", () => {
    expect(isPlatformEscapePath("/profile")).toBe(true);
    expect(isPlatformEscapePath("/learn/way21/day-1")).toBe(true);
    expect(isPlatformEscapePath("/admin/orders")).toBe(true);
    expect(isPlatformEscapePath("/profiles")).toBe(false);
    expect(isPlatformEscapePath("/")).toBe(false);
    expect(isPlatformEscapePath("/thanks")).toBe(false);
  });

  it("sends a public page back to the platform origin instead of 404ing", () => {
    const response = rewriteFunnelHostRequest(request("way21.centerway.net.ua", "/programs"));
    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toBe("https://www.centerway.net.ua/programs");
  });

  /* The cabinet and the shelf moved to the personal host, so the escape names
     the origin that owns them — otherwise the hop off a funnel host would land
     on a 308 and cost a second one. */
  it("sends a personal page to the personal origin", () => {
    const response = rewriteFunnelHostRequest(request("way21.centerway.net.ua", "/profile"));
    expect(response?.status).toBe(307);
    expect(response?.headers.get("location")).toBe("https://my.centerway.net.ua/profile");
  });

  it("keeps the query string, which is where the return path rides", () => {
    const response = rewriteFunnelHostRequest(request("irem.centerway.net.ua", "/learn/irem?from=mail"));
    expect(response?.headers.get("location")).toBe("https://my.centerway.net.ua/learn/irem?from=mail");
  });

  /* The landing still owns its own root and its own thank-you page: the escape
     runs last, so anything the funnel claimed is claimed before it is reached. */
  it("does not touch the landing's own pages", () => {
    const response = rewriteFunnelHostRequest(request("way21.centerway.net.ua", "/"));
    expect(response?.status).not.toBe(307);
  });

  /* The dosha host serves /tests in place — it returns before the escape, and
     that ordering is the reason the prefix can be on the list at all. */
  it("leaves the dosha host's own test routes where they are", () => {
    const response = rewriteFunnelHostRequest(request("dosha.centerway.net.ua", "/tests/dosha"));
    expect(response?.status).not.toBe(307);
    expect(response?.headers.get("x-middleware-rewrite")).toContain("/tests/dosha");
  });
});
