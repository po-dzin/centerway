import { describe, expect, it } from "vitest";
import { NextRequest, NextResponse } from "next/server";

import { readAttribution, rememberAttribution, UTM_COOKIE } from "./attribution";
import { REF_COOKIE } from "./ref";

function request(url: string, cookies: Record<string, string> = {}, host = "www.centerway.net.ua") {
  const cookie = Object.entries(cookies)
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
  return new NextRequest(url, { headers: { host, ...(cookie ? { cookie } : {}) } });
}

describe("rememberAttribution", () => {
  it("keeps a friend's tag on the parent domain so my. sees what www. was given", () => {
    const res = rememberAttribution(request("https://www.centerway.net.ua/way21?ref=Olena"), NextResponse.next());
    const cookie = res.cookies.get(REF_COOKIE);
    expect(cookie).toMatchObject({ value: "olena", domain: ".centerway.net.ua", secure: true, sameSite: "lax" });
  });

  it("lets the first touch stand", () => {
    const res = rememberAttribution(
      request("https://www.centerway.net.ua/way21?ref=taras", { [REF_COOKIE]: "olena" }),
      NextResponse.next(),
    );
    expect(res.cookies.get(REF_COOKIE)).toBeUndefined();
  });

  it("replaces the campaign with the latest one clicked", () => {
    const res = rememberAttribution(
      request("https://www.centerway.net.ua/programs/way21?utm_source=ig&utm_campaign=october", {
        [UTM_COOKIE]: encodeURIComponent("utm_campaign=september"),
      }),
      NextResponse.next(),
    );
    expect(res.cookies.get(UTM_COOKIE)?.value).toBe("utm_source=ig&utm_campaign=october");
  });

  it("sets nothing on the ordinary request, and no Domain off the production hosts", () => {
    expect(
      rememberAttribution(request("https://www.centerway.net.ua/programs"), NextResponse.next()).cookies.getAll(),
    ).toEqual([]);
    const local = rememberAttribution(
      request("http://localhost:3000/way21?ref=olena", {}, "localhost:3000"),
      NextResponse.next(),
    );
    expect(local.cookies.get(REF_COOKIE)?.domain).toBeUndefined();
  });
});

describe("readAttribution", () => {
  it("reads what the proxy remembered when the request itself says nothing", () => {
    const req = request("https://my.centerway.net.ua/api/lms/courses/way21", {
      [REF_COOKIE]: "olena",
      [UTM_COOKIE]: encodeURIComponent("utm_source=ig&utm_campaign=october"),
    });
    expect(readAttribution(req)).toEqual({ ref: "olena", utm: { source: "ig", campaign: "october" } });
  });

  it("ignores a cookie that is not a tag", () => {
    expect(readAttribution(request("https://www.centerway.net.ua/", { [REF_COOKIE]: "%3Cx%3E" })).ref).toBeNull();
  });
});
