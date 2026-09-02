import { describe, expect, it } from "vitest";
import { fulfilmentDestination, orderFulfilment } from "./fulfilmentDestination";

/**
 * The bug these cover shipped because nothing asserted where the operator's
 * "resend access" link pointed: it was assembled in the click handler from
 * `window.location.origin` and a guessed path, and the guess (`/pay/return?
 * token=…`) was a route that reads no token. Every one of these is a claim
 * about an address a real person is asked to open.
 */
describe("orderFulfilment", () => {
  it("addresses a builder course by the slug inside its offer code", () => {
    expect(orderFulfilment("course:soul-daily-ritual")).toEqual({
      kind: "course",
      courseSlug: "soul-daily-ritual",
    });
  });

  it("reads a catalogue product's fulfilment rather than assuming the code is the slug", () => {
    // `short` is sold as /programs/reboot and read at /learn/short — the two
    // slugs differ, which is the whole reason fulfilment is a lookup.
    expect(orderFulfilment("short")).toMatchObject({ kind: "course", courseSlug: "short" });
  });

  it("resolves every product code production has actually filed an order under", () => {
    /* Read off `select distinct product_code from orders` on 2026-09-02. The
       operator's button is pressed against rows that exist, so this list — not
       an invented one — is what it has to answer for. `reboot` rides along as
       the alias `short` was sold under before 2026-08-29. */
    const live: Record<string, ReturnType<typeof orderFulfilment>["kind"]> = {
      "course:natural-body": "course",
      "course:novyi-kurs-5": "course",
      "course:reset-day": "course",
      "course:way21": "course",
      irem: "course",
      "reset-day": "course",
      short: "course",
      way21: "course",
      "way21-support": "course",
      reboot: "course",
      // A consultation and a herbal blend are not read on the platform; the
      // cabinet, which lists everything the person owns, is the honest answer.
      consult: "cabinet",
      herbs: "cabinet",
    };

    for (const [code, kind] of Object.entries(live)) {
      expect(orderFulfilment(code).kind, code).toBe(kind);
    }
  });

  it("keeps the course slug distinct from the code it is sold under", () => {
    // `irem` is read at /learn/irem-gymnastics, and `short` at /learn/short
    // while being sold as /programs/reboot. Treating the order's code as the
    // slug — the shortcut the old button effectively took — sends the buyer to
    // a course that does not exist.
    expect(orderFulfilment("irem")).toMatchObject({ courseSlug: "irem-gymnastics" });
    expect(orderFulfilment("reboot")).toMatchObject({ courseSlug: "short" });
  });

  it("falls back to the cabinet, never to nothing", () => {
    for (const code of [null, undefined, "", "   ", "no-such-product"]) {
      expect(orderFulfilment(code)).toEqual({ kind: "cabinet" });
    }
  });

  it("refuses a malformed course code instead of building an address from it", () => {
    // The slug becomes a URL path segment, so anything outside the shape
    // `slugify` produces must not survive as one.
    expect(orderFulfilment("course:../../etc/passwd")).toEqual({ kind: "cabinet" });
    expect(orderFulfilment("course:")).toEqual({ kind: "cabinet" });
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
