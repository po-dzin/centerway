import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeSupabase } from "@/lib/admin/fakeSupabase";

import { buildStreamEmail, buildWelcomeEmail, ukDate, type Links } from "./lifecycleEmails";

const db = new FakeSupabase();
const sent: { to: string; subject: string; idempotencyKey?: string }[] = [];

vi.mock("@/lib/auth/adminClient", () => ({ adminClient: () => db }));
vi.mock("@/lib/email/resend", async (importOriginal) => {
  const original = await importOriginal<typeof import("./resend")>();
  return {
    ...original,
    sendEmail: async (input: { to: string; subject: string; idempotencyKey?: string }) => {
      sent.push(input);
      return { sent: true, id: `re_${sent.length}` };
    },
  };
});

const { runWelcomeEmails, runStreamEmails, kyivDate } = await import("./lifecycleRuns");

const links: Links = {
  cabinetUrl: "https://my.centerway.net.ua/",
  programsUrl: "https://www.centerway.net.ua/programs",
  doshaTestUrl: "https://www.centerway.net.ua/dosha-test",
  supportUrl: "https://t.me/support",
};

describe("lifecycle letters", () => {
  it("writes the date the way a person reads it", () => {
    expect(ukDate("2026-10-01")).toBe("1 жовтня");
  });

  it("greets by first name and leaves the channel out until it exists", () => {
    const letter = buildWelcomeEmail({ name: "Анна Коваль", links });
    expect(letter.subject).toBe("Вітаємо в CenterWay");
    expect(letter.text).toContain("Вітаємо, Анна!");
    expect(letter.text).not.toContain("Telegram-каналі");
    expect(letter.text).toContain("Команда CenterWay");
    const withChannel = buildWelcomeEmail({ name: null, links: { ...links, channelUrl: "https://t.me/centerway" } });
    expect(withChannel.text).toContain("Вітаємо!");
    expect(withChannel.html).toContain('href="https://t.me/centerway"');
  });

  it("escapes a name that tries to be markup", () => {
    const letter = buildWelcomeEmail({ name: "<script>", links });
    expect(letter.html).not.toContain("<script>");
  });

  it("says when the stream starts and where the chat is, or that the link will follow", () => {
    const tomorrow = buildStreamEmail({ stage: "tomorrow", programTitle: "Шлях 21", startsOn: "2026-10-01", links });
    expect(tomorrow.subject).toBe("Завтра стартує Шлях 21");
    expect(tomorrow.text).toContain("Завтра, 1 жовтня");
    expect(tomorrow.text).toContain("надішлемо окремим повідомленням");
    const day1 = buildStreamEmail({
      stage: "day1",
      programTitle: "Шлях 21",
      startsOn: "2026-10-01",
      links: { ...links, streamChatUrl: "https://t.me/+stream" },
    });
    expect(day1.subject).toBe("День 1 · Шлях 21");
    expect(day1.html).toContain('href="https://t.me/+stream"');
  });
});

describe("lifecycle runs", () => {
  beforeEach(() => {
    sent.length = 0;
    for (const table of Object.keys(db.tables)) db.tables[table] = [];
  });

  it("welcomes each new account once and never the ones from before the line", async () => {
    db.tables.platform_users = [
      { auth_user_id: "u-old", email: "old@x.com", full_name: "Old", created_at: "2026-09-20T10:00:00.000Z" },
      { auth_user_id: "u-new", email: "New@X.com", full_name: "Нова Людина", created_at: "2026-09-30T08:00:00.000Z" },
      { auth_user_id: "u-bad", email: "not-an-email", full_name: null, created_at: "2026-09-30T08:00:00.000Z" },
    ];
    const now = new Date("2026-09-30T09:00:00.000Z");

    const first = await runWelcomeEmails(now);
    expect(first).toEqual({ candidates: 1, sent: 1, skipped: 0, failed: 0 });
    expect(sent.map((s) => s.to)).toEqual(["new@x.com"]);
    expect(sent[0]?.idempotencyKey).toBe("lifecycle-welcome:u-new");

    const second = await runWelcomeEmails(now);
    expect(second).toEqual({ candidates: 1, sent: 0, skipped: 1, failed: 0 });
    expect(sent).toHaveLength(1);
  });

  it("counts tomorrow and today in Kyiv, not in UTC", () => {
    // 22:30 UTC on 30.09 is already 1 October in Kyiv.
    expect(kyivDate(new Date("2026-09-30T22:30:00.000Z"))).toBe("2026-10-01");
    expect(kyivDate(new Date("2026-09-30T06:00:00.000Z"), 1)).toBe("2026-10-01");
  });

  it("finds a stream's buyers and granted friends once each, and leaves self-paced alone", async () => {
    db.tables.experience_offers = [
      {
        id: "o-group",
        code: "way21-group",
        format: "group",
        cohort_starts_on: "2026-10-01",
        experience_id: "x-way21",
        label: null,
      },
      {
        id: "o-self",
        code: "course:way21",
        format: "self",
        cohort_starts_on: null,
        experience_id: "x-way21",
        label: null,
      },
    ];
    db.tables.experiences = [{ id: "x-way21", title: "Шлях 21" }];
    db.tables.orders = [
      { order_ref: "a", status: "paid", offer_id: "o-group", customer_id: "c1" },
      { order_ref: "b", status: "created", offer_id: "o-group", customer_id: "c2" },
      { order_ref: "c", status: "paid", offer_id: "o-self", customer_id: "c3" },
    ];
    db.tables.customers = [
      { id: "c1", email: "buyer@x.com", display_name: "Марія" },
      { id: "c2", email: "unpaid@x.com", display_name: null },
      { id: "c3", email: "solo@x.com", display_name: null },
    ];
    db.tables.lms_enrollments = [
      {
        auth_user_id: "u-friend",
        course_id: "k-way21",
        cohort_starts_on: "2026-10-01",
        status: "active",
        revoked_at: null,
      },
      {
        auth_user_id: "u-buyer",
        course_id: "k-way21",
        cohort_starts_on: "2026-10-01",
        status: "active",
        revoked_at: null,
      },
    ];
    db.tables.platform_users = [
      { auth_user_id: "u-friend", email: "friend@x.com", full_name: "Друг" },
      { auth_user_id: "u-buyer", email: "BUYER@x.com", full_name: "Марія" },
    ];
    db.tables.lms_courses = [{ id: "k-way21", title: "Шлях 21" }];

    // 30.09 morning in Kyiv: tomorrow is the stream's day 1.
    const result = await runStreamEmails(new Date("2026-09-30T06:00:00.000Z"));
    expect(result.tomorrow).toEqual({ candidates: 2, sent: 2, skipped: 0, failed: 0 });
    expect(result.day1.candidates).toBe(0);
    expect(sent.map((s) => s.to).sort()).toEqual(["buyer@x.com", "friend@x.com"]);
    expect(sent.every((s) => s.subject === "Завтра стартує Шлях 21")).toBe(true);

    // A second run the same morning sends nothing more.
    const again = await runStreamEmails(new Date("2026-09-30T06:05:00.000Z"));
    expect(again.tomorrow.sent).toBe(0);
    expect(sent).toHaveLength(2);
  });
});
