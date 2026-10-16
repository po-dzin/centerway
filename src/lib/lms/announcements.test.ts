import { describe, expect, it } from "vitest";

import { FakeSupabase } from "@/lib/admin/fakeSupabase";

import {
  announcementHref,
  courseLessonTitles,
  nextAnnouncementAt,
  normalizeAnnouncementBody,
  readAnnouncementAudience,
} from "./announcements";

describe("normalizeAnnouncementBody", () => {
  it("trims, folds blank runs, and refuses empty or too long text", () => {
    expect(normalizeAnnouncementBody("  Привіт!\r\n\r\n\r\n\r\nДо зустрічі  ")).toBe("Привіт!\n\nДо зустрічі");
    expect(normalizeAnnouncementBody("   ")).toBeNull();
    expect(normalizeAnnouncementBody(42)).toBeNull();
    expect(normalizeAnnouncementBody("а".repeat(1001))).toBeNull();
    expect(normalizeAnnouncementBody("а".repeat(1000))).toHaveLength(1000);
  });
});

describe("nextAnnouncementAt", () => {
  const now = new Date("2026-10-15T12:00:00Z");
  it("holds the day after the last one, then opens", () => {
    expect(nextAnnouncementAt(null, now)).toBeNull();
    expect(nextAnnouncementAt("2026-10-15T09:00:00Z", now)).toBe("2026-10-16T09:00:00.000Z");
    expect(nextAnnouncementAt("2026-10-14T11:59:00Z", now)).toBeNull();
  });
});

describe("announcementHref / courseLessonTitles", () => {
  it("leads to the lesson when one is chosen, else to the course", () => {
    expect(announcementHref("way21", "day-5")).toBe("/learn/way21/day-5");
    expect(announcementHref("way21", null)).toBe("/learn/way21");
  });

  it("lists lessons across modules in order", () => {
    const titles = courseLessonTitles({
      modules: [{ lessons: [{ slug: "d1", title: "День 1" }] }, { lessons: [{ slug: "d2", title: "День 2" }] }],
    } as never);
    expect([...titles]).toEqual([
      ["d1", "День 1"],
      ["d2", "День 2"],
    ]);
  });
});

describe("readAnnouncementAudience", () => {
  it("takes open enrollments and paid buyers who never opened, and leaves out closed access", async () => {
    const db = new FakeSupabase({
      lms_enrollments: [
        { auth_user_id: "u-open", course_id: "c1", status: "active", blocked_at: null, expires_at: null },
        {
          auth_user_id: "u-expired",
          course_id: "c1",
          status: "active",
          blocked_at: null,
          expires_at: "2026-01-01T00:00:00Z",
        },
        {
          auth_user_id: "u-blocked",
          course_id: "c1",
          status: "active",
          blocked_at: "2026-10-01T00:00:00Z",
          expires_at: null,
        },
        { auth_user_id: "u-other", course_id: "c2", status: "active", blocked_at: null, expires_at: null },
      ],
      orders: [
        { order_ref: "o1", customer_id: "cust-new", status: "paid", product_code: "course:way21" },
        { order_ref: "o2", customer_id: "cust-expired", status: "paid", product_code: "course:way21" },
        { order_ref: "o3", customer_id: "cust-refund", status: "refunded", product_code: "course:way21" },
        { order_ref: "o4", customer_id: "cust-bundle", status: "paid", product_code: "bundle" },
        { order_ref: "o5", customer_id: "cust-guest", status: "paid", product_code: "course:way21" },
        { order_ref: "o6", customer_id: "cust-guest-no-chat", status: "paid", product_code: "course:way21" },
        { order_ref: "o7", customer_id: "cust-guest-expired-chat", status: "paid", product_code: "course:way21" },
      ],
      customers: [
        { id: "cust-new", auth_user_id: "u-new", tg_id: null },
        { id: "cust-expired", auth_user_id: "u-expired", tg_id: "900" },
        { id: "cust-refund", auth_user_id: "u-refund", tg_id: null },
        { id: "cust-bundle", auth_user_id: "u-bundle", tg_id: null },
        // Paid, never signed in, the bot knows the chat: reached as a guest.
        { id: "cust-guest", auth_user_id: null, tg_id: "701" },
        // Paid, never signed in, no chat: nothing can reach them yet.
        { id: "cust-guest-no-chat", auth_user_id: null, tg_id: null },
        // The same chat as an expired account: the account's «no» stands.
        { id: "cust-guest-expired-chat", auth_user_id: null, tg_id: "900" },
      ],
      lms_courses: [{ id: "c1", experience_id: null }],
    });
    const audience = await readAnnouncementAudience(
      db as never,
      { id: "c1", slug: "way21", entitlementProductCodes: [] },
      new Date("2026-10-15T12:00:00Z"),
    );
    expect(audience.accounts.sort()).toEqual(["u-new", "u-open"]);
    expect(audience.guests).toEqual(["cust-guest"]);
  });
});
