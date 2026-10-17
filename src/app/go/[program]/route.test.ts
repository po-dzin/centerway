/**
 * `/go/<program>`: one address per program, whatever it is called today.
 * Without a personal offer it leads to the course on the personal host; with
 * one, to the storefront page that charges it. The old `/go/irem` contract —
 * an identity and a campaign in, a personal IREM price out — still holds.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import type { Course } from "@/lms-core";

const course = (slug: string, programSlug: string, status = "published") =>
  ({ slug, programSlug, status }) as unknown as Course;

const listLiveCourses = vi.fn(async () => [
  course("way21", "way21"),
  course("short", "reboot"),
  course("irem-gymnastics", "irem"),
  course("draft-one", "draft-one", "draft"),
]);
const resolveExperience = vi.fn(async (_db: unknown, name: string) =>
  name === "idealne-tilo" ? { experience: { slug: "way21" }, via: "alias" } : null,
);
const issueOrReuseIremPersonalOffer = vi.fn(async () => ({ offer: { offerToken: "issued" }, reused: false }));

vi.mock("@/lib/lms/liveCatalog", () => ({ listLiveCourses }));
vi.mock("@/lib/experiences/registry", () => ({ resolveExperience }));
vi.mock("@/lib/auth/adminClient", () => ({ adminClient: () => ({}) }));
vi.mock("@/lib/landing/offers", () => ({
  IREM_OFFER_CODE: "course:irem-gymnastics",
  issueOrReuseIremPersonalOffer,
}));

const { GET } = await import("./route");

async function go(path: string): Promise<string | null> {
  const url = new URL(path, "https://www.centerway.net.ua");
  const program = decodeURIComponent(url.pathname.split("/")[2] ?? "");
  const res = await GET(new NextRequest(url), { params: Promise.resolve({ program }) });
  expect(res.status).toBe(302);
  return res.headers.get("location");
}

beforeEach(() => {
  issueOrReuseIremPersonalOffer.mockClear();
});

describe("/go/<program>", () => {
  it("leads to the course on the personal host, by its row slug", async () => {
    expect(await go("/go/way21")).toBe("https://my.centerway.net.ua/way21");
    expect(await go("/go/reboot")).toBe("https://my.centerway.net.ua/short");
    expect(await go("/go/IREM")).toBe("https://my.centerway.net.ua/irem-gymnastics");
  });

  it("answers to the row slug and to any old name the registry remembers", async () => {
    expect(await go("/go/short")).toBe("https://my.centerway.net.ua/short");
    expect(await go("/go/idealne-tilo")).toBe("https://my.centerway.net.ua/way21");
  });

  it("keeps attribution and drops who the reader is", async () => {
    expect(await go("/go/way21?utm_source=mail&email=a@b.c")).toBe("https://my.centerway.net.ua/way21?utm_source=mail");
  });

  it("sends a personal offer to the storefront page", async () => {
    expect(await go("/go/irem-gymnastics?offer_token=tok&utm_source=tg")).toBe(
      "https://www.centerway.net.ua/programs/irem?offer_token=tok&utm_source=tg",
    );
  });

  it("issues a personal IREM price for an identity and a campaign, as /go/irem did", async () => {
    const location = await go("/go/irem?tgUserId=42&campaign=launch&utm_source=smartsender");
    expect(location).toBe("https://www.centerway.net.ua/programs/irem?offer_token=issued&utm_source=smartsender");
    expect(issueOrReuseIremPersonalOffer).toHaveBeenCalledWith(
      expect.objectContaining({ recipientKey: "tg:42", campaign: "launch", channel: "telegram" }),
    );
  });

  it("issues nothing for another program, or without a campaign", async () => {
    expect(await go("/go/way21?tgUserId=42&campaign=launch")).toBe("https://my.centerway.net.ua/way21");
    expect(await go("/go/irem?tgUserId=42")).toBe("https://my.centerway.net.ua/irem-gymnastics");
    expect(issueOrReuseIremPersonalOffer).not.toHaveBeenCalled();
  });

  it("still reaches the page when issuing fails", async () => {
    issueOrReuseIremPersonalOffer.mockRejectedValueOnce(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await go("/go/irem?email=A@B.c&campaign=launch")).toBe("https://my.centerway.net.ua/irem-gymnastics");
    spy.mockRestore();
  });

  it("sends an unknown name or a draft to the catalogue", async () => {
    expect(await go("/go/nothing-here")).toBe("https://www.centerway.net.ua/programs");
    expect(await go("/go/draft-one")).toBe("https://www.centerway.net.ua/programs");
  });
});
