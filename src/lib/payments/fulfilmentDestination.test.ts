import { beforeEach, describe, expect, it } from "vitest";

import { FakeSupabase } from "@/lib/admin/fakeSupabase";
import { fulfilmentDestination, orderFulfilment } from "./fulfilmentDestination";

/**
 * The bug these cover shipped because nothing asserted where the operator's
 * "resend access" link pointed: it was assembled in the click handler from
 * `window.location.origin` and a guessed path, and the guess (`/pay/return?
 * token=…`) was a route that reads no token. Every one of these is a claim
 * about an address a real person is asked to open.
 */
const db = new FakeSupabase();

beforeEach(() => {
  db.failures = {};
  db.tables = {
    experiences: [
      { id: "exp-reboot", kind: "mini", slug: "reboot", title: null },
      { id: "exp-irem", kind: "course", slug: "irem", title: null },
      { id: "exp-way21", kind: "course", slug: "way21", title: null },
      { id: "exp-herbs", kind: "physical", slug: "herbs", title: "Фітозбір" },
    ],
    lms_courses: [
      { slug: "short", program_slug: "reboot", experience_id: "exp-reboot", created_at: "2026-01-01" },
      { slug: "irem-gymnastics", program_slug: "irem", experience_id: "exp-irem", created_at: "2026-01-01" },
      { slug: "way21", program_slug: "way21", experience_id: "exp-way21", created_at: "2026-01-01" },
    ],
    experience_offers: [
      { id: "o-short", experience_id: "exp-reboot", code: "course:short", active: true },
      { id: "o-irem", experience_id: "exp-irem", code: "course:irem-gymnastics", active: true },
      { id: "o-way21", experience_id: "exp-way21", code: "course:way21", active: true },
      { id: "o-support", experience_id: "exp-way21", code: "way21-support", active: true, format: "individual" },
      { id: "o-herbs", experience_id: "exp-herbs", code: "herbs", active: true },
    ],
    offer_aliases: [
      { code: "short", offer_id: "o-short" },
      { code: "reboot", offer_id: "o-short" },
      { code: "irem", offer_id: "o-irem" },
      { code: "way21", offer_id: "o-way21" },
    ],
  };
});

describe("orderFulfilment", () => {
  it("addresses a builder course by the slug inside its offer code, even with no row", async () => {
    expect(await orderFulfilment(db as never, "course:soul-daily-ritual")).toEqual({
      kind: "course",
      courseSlug: "soul-daily-ritual",
    });
  });

  it("reads an old spelling through offer_aliases rather than assuming the code is the slug", async () => {
    // `short` is sold as /programs/reboot and read at /learn/short, `irem` is
    // read at /learn/irem-gymnastics — treating the order's code as the slug,
    // the shortcut the old button took, sends the buyer nowhere.
    expect(await orderFulfilment(db as never, "reboot")).toEqual({
      kind: "course",
      courseSlug: "short",
      programSlug: "reboot",
    });
    expect(await orderFulfilment(db as never, "irem")).toMatchObject({ courseSlug: "irem-gymnastics" });
  });

  it("delivers a guided package through the course it opens", async () => {
    expect(await orderFulfilment(db as never, "way21-support")).toMatchObject({ kind: "course", courseSlug: "way21" });
  });

  it("sends a thing with no course to the cabinet", async () => {
    expect(await orderFulfilment(db as never, "herbs")).toEqual({ kind: "cabinet" });
  });

  it("falls back to the cabinet, never to nothing", async () => {
    for (const code of [null, undefined, "", "   ", "no-such-product"]) {
      expect(await orderFulfilment(db as never, code)).toEqual({ kind: "cabinet" });
    }
    db.failures = { "experience_offers:select": "boom" };
    expect(await orderFulfilment(db as never, "reboot")).toEqual({ kind: "cabinet" });
  });

  it("refuses a malformed course code instead of building an address from it", async () => {
    // The slug becomes a URL path segment, so anything outside the shape
    // `slugify` produces must not survive as one.
    expect(await orderFulfilment(db as never, "course:../../etc/passwd")).toEqual({ kind: "cabinet" });
    expect(await orderFulfilment(db as never, "course:")).toEqual({ kind: "cabinet" });
  });
});

describe("fulfilmentDestination", () => {
  it("returns absolute links, because they are read in mail and pasted from a clipboard", () => {
    const course = fulfilmentDestination({ kind: "course", courseSlug: "way21" });
    const cabinet = fulfilmentDestination({ kind: "cabinet" });

    for (const { href } of [course, cabinet]) {
      expect(href).toMatch(/^https:\/\//);
    }
    // A course lives at the ROOT of the personal host — `surfaceUrl` strips the
    // `/learn` prefix on purpose (`canonicalPersonalPath`), so the address is
    // `my…/way21` and not `my…/learn/way21`. Asserted because the whole point
    // of this module is that nobody assembles that address by hand again.
    expect(new URL(course.href).pathname).toBe("/way21");
  });

  it("sends a bot product to the bot, not to the platform", () => {
    const url = "https://t.me/example_bot";
    expect(fulfilmentDestination({ kind: "bot", url })).toEqual({
      href: url,
      label: "Відкрити бот",
    });
  });

  it("never points at the payment return route, which reads no token", () => {
    const hrefs = [
      fulfilmentDestination({ kind: "course", courseSlug: "way21" }).href,
      fulfilmentDestination({ kind: "cabinet" }).href,
    ];
    for (const href of hrefs) {
      expect(href).not.toContain("/pay/return");
      expect(href).not.toContain("token=");
    }
  });
});
