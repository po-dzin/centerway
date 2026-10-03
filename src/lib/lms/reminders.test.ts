/**
 * Reminders against bundles — who is nudged about what.
 *
 * A program format can carry other programs in (the Шлях 21 cohort opens Reset
 * Day and Short). The door must open them; the REMINDERS must not treat them as
 * purchases. Guarded here, on both crons, over the in-memory fake:
 *
 *   · «you paid and never opened it» goes out under a course's OWN codes only:
 *     the cohort buyer hears about Шлях 21 once, never about Reset Day;
 *     someone who bought Reset Day for itself still hears about it.
 *   · the daily «today's step» skips a seat held through a bundle — a `bonus`
 *     seat, or one whose order is not one of the course's own codes — and still
 *     reminds a seat bought for itself.
 *
 * And the path those rules sit in: claim before send, release on a failed
 * delivery, one nudge per learner per course, closed access stays silent, the
 * day-1 picture goes out once.
 *
 * And the letter fallback: a learner Telegram cannot reach gets the same
 * reminder by email — only under `LIFECYCLE_EMAILS=on`, never on top of a
 * linked Telegram, claimed on its own `email` row and released on failure.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FakeSupabase, type Row } from "@/lib/admin/fakeSupabase";
import type { Course, CourseModule } from "@/lms-core";

const db = new FakeSupabase();
let catalog: Course[] = [];
const notifyLearner = vi.fn();
const sendEmail = vi.fn();

vi.mock("@/lib/auth/adminClient", () => ({ adminClient: () => db }));
vi.mock("./liveCatalog", () => ({
  listLiveCourses: async () => catalog,
  getLiveCourse: async (slug: string) => catalog.find((entry) => entry.slug === slug) ?? null,
}));
vi.mock("./notify", () => ({ notifyLearner: (...args: unknown[]) => notifyLearner(...args) }));
vi.mock("@/lib/email/resend", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email/resend")>()),
  sendEmail: (...args: unknown[]) => sendEmail(...args),
}));

const { runUnstartedReminders, runDailyReminders } = await import("./reminders");

// 15:00 in Kyiv. Both crons run under the deployed `single-daily-run` policy
// unless a test is about the hour.
const NOW = new Date("2026-09-26T12:00:00.000Z");

function dailyModule(id: string, days: number): CourseModule {
  return {
    id,
    slug: id,
    title: id,
    order: 1,
    lessons: Array.from({ length: days }, (_, index) => ({
      id: `${id}-d${index + 1}`,
      slug: `day-${index + 1}`,
      title: `Day ${index + 1}`,
      order: index + 1,
      dayIndex: index + 1,
      blocks: [],
    })),
  };
}

function course(id: string, slug: string, declared: string[], extra: Partial<Course> = {}): Course {
  return {
    id,
    slug,
    title: slug,
    programSlug: slug,
    brand: "centerway",
    locale: "uk",
    translationGroupId: id,
    status: "published",
    version: 1,
    schedule: { mode: "daily", reminderHour: 9 },
    entitlementProductCodes: declared,
    modules: [dailyModule(`${id}-m`, 3)],
    ...extra,
  } as Course;
}

const WAY21 = course("course-way21", "way21", ["way21"]);
const RESET = course("course-reset", "reset-day", ["reset-day"], { cover: { src: "/reset.webp", alt: "Reset" } });
const SHORT = course("course-short", "short", []);

function order(ref: string, productCode: string, customerId = "cus-1", createdAt = "2026-09-22T09:00:00.000Z"): Row {
  return { order_ref: ref, product_code: productCode, status: "paid", customer_id: customerId, created_at: createdAt };
}

function enrollment(id: string, courseId: string, overrides: Row = {}): Row {
  return {
    id,
    course_id: courseId,
    auth_user_id: "auth-1",
    // Day 2 in Kyiv at NOW.
    started_at: "2026-09-25T06:00:00.000Z",
    cohort_starts_on: null,
    expires_at: null,
    status: "active",
    blocked_at: null,
    source: "order",
    order_ref: null,
    ...overrides,
  };
}

function seed(input: { orders?: Row[]; enrollments?: Row[] } = {}) {
  catalog = [WAY21, RESET, SHORT];
  db.tables = {
    lms_courses: [
      { id: "course-way21", experience_id: "exp-way21" },
      { id: "course-reset", experience_id: "exp-reset" },
      { id: "course-short", experience_id: null },
    ],
    experience_offers: [
      { id: "offer-way21-self", code: "course:way21", experience_id: "exp-way21" },
      // The cohort format: belongs to Шлях 21, carries the other two in.
      { id: "offer-way21-group", code: "way21-group", experience_id: "exp-way21" },
      { id: "offer-reset", code: "course:reset-day", experience_id: "exp-reset" },
    ],
    offer_aliases: [{ code: "reset-legacy", offer_id: "offer-reset" }],
    orders: input.orders ?? [],
    customers: [
      { id: "cus-1", auth_user_id: "auth-1" },
      { id: "cus-2", auth_user_id: "auth-2" },
      { id: "cus-guest", auth_user_id: null },
    ],
    platform_users: [
      { auth_user_id: "auth-1", timezone: "Europe/Kyiv" },
      { auth_user_id: "auth-2", timezone: "Europe/Kyiv" },
    ],
    lms_enrollments: input.enrollments ?? [],
    lms_unstarted_reminders: [],
    lms_reminder_log: [],
    lms_progress_events: [],
    messaging_subscriptions: [],
  };
  db.failures = {};
  db.uniqueKeys = {
    lms_unstarted_reminders: [["order_ref", "nudge_number", "channel"]],
    lms_reminder_log: [["enrollment_id", "day_number", "channel"]],
  };
}

beforeEach(() => {
  seed();
  notifyLearner.mockReset();
  notifyLearner.mockResolvedValue({ delivered: true });
  sendEmail.mockReset();
  sendEmail.mockResolvedValue({ sent: true, id: "re_1" });
  // Off unless a test turns it on — whatever the shell running the suite has.
  vi.stubEnv("LIFECYCLE_EMAILS", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const nudgedCourses = () => notifyLearner.mock.calls.map(([arg]) => (arg as { href: string }).href);

describe("runUnstartedReminders — a bundle is one purchase, not three", () => {
  it("nudges the cohort buyer about the program they chose, and not about what it carried", async () => {
    seed({ orders: [order("ord-group", "way21-group")] });

    const result = await runUnstartedReminders(500, NOW, "single-daily-run");

    expect(result.sent).toBe(1);
    expect(nudgedCourses()).toEqual(["/learn/way21"]);
    expect(db.rows("lms_unstarted_reminders")).toEqual([
      expect.objectContaining({ order_ref: "ord-group", course_id: "course-way21", nudge_number: 1 }),
    ]);
  });

  it("still nudges someone who bought the carried program for itself — by its declared, course:, or old code", async () => {
    seed({
      orders: [order("ord-reset", "reset-legacy"), order("ord-short", "course:short", "cus-2")],
    });

    const result = await runUnstartedReminders(500, NOW, "single-daily-run");

    expect(result.sent).toBe(2);
    expect(nudgedCourses().sort()).toEqual(["/learn/reset-day", "/learn/short"]);
    // The course's own cover when it has one.
    const reset = notifyLearner.mock.calls.find(([arg]) => (arg as { href: string }).href === "/learn/reset-day");
    expect(reset?.[0]).toMatchObject({ imageSrc: "/reset.webp", actionLabel: "Почати курс" });
  });

  it("narrows to declared codes when the offer tables cannot be read — the bundle still does not nag", async () => {
    seed({ orders: [order("ord-group", "way21-group"), order("ord-reset", "reset-day", "cus-2")] });
    db.failures = { "lms_courses:select": "boom" };

    await runUnstartedReminders(500, NOW, "single-daily-run");

    // Шлях 21's group code is not a DECLARED code, so without the tables it is
    // not nudged either: a failed read only ever narrows who hears from us.
    expect(nudgedCourses()).toEqual(["/learn/reset-day"]);
  });
});

describe("runUnstartedReminders — the path", () => {
  it("skips a learner who already opened the course, and one who never signed in", async () => {
    seed({
      orders: [order("ord-1", "course:way21"), order("ord-guest", "course:way21", "cus-guest")],
      enrollments: [enrollment("enr-1", "course-way21")],
    });

    const result = await runUnstartedReminders(500, NOW, "single-daily-run");

    expect(result).toMatchObject({ scanned: 1, sent: 0, skipped: { already_started: 1 } });
    expect(notifyLearner).not.toHaveBeenCalled();
  });

  it("messages a learner who bought twice once, and counts the second order as a duplicate", async () => {
    seed({ orders: [order("ord-1", "course:way21"), order("ord-2", "way21", "cus-1", "2026-09-23T09:00:00.000Z")] });

    const result = await runUnstartedReminders(500, NOW, "single-daily-run");

    expect(result.sent).toBe(1);
    expect(result.skipped).toMatchObject({ duplicate_order: 1 });
  });

  it("waits until day 2, and does not repeat a nudge already claimed", async () => {
    seed({ orders: [order("ord-1", "course:way21", "cus-1", "2026-09-26T08:00:00.000Z")] });
    expect(await runUnstartedReminders(500, NOW, "single-daily-run")).toMatchObject({
      sent: 0,
      skipped: { too_early: 1 },
    });

    seed({ orders: [order("ord-1", "course:way21")] });
    await runUnstartedReminders(500, NOW, "single-daily-run");
    const again = await runUnstartedReminders(500, NOW, "single-daily-run");
    expect(again).toMatchObject({ sent: 0, skipped: { too_early: 1 } });
    expect(notifyLearner).toHaveBeenCalledTimes(1);
  });

  it("releases the claim when delivery fails, so the next run tries again", async () => {
    seed({ orders: [order("ord-1", "course:way21")] });
    notifyLearner.mockResolvedValue({ delivered: false, reason: "no_channel" });

    const result = await runUnstartedReminders(500, NOW, "single-daily-run");

    expect(result.skipped).toMatchObject({ "undelivered:no_channel": 1 });
    expect(db.rows("lms_unstarted_reminders")).toHaveLength(0);
  });

  it("under the hourly design, stays quiet outside the learner's reminder hour", async () => {
    seed({ orders: [order("ord-1", "course:way21")] });
    const result = await runUnstartedReminders(500, NOW, "learner-local");
    expect(result).toMatchObject({ sent: 0, skipped: { wrong_hour: 1 } });
  });
});

describe("runDailyReminders — a carried program stays quiet", () => {
  it("reminds the seat bought for itself and skips the seats a bundle carried in", async () => {
    seed({
      orders: [order("ord-group", "way21-group"), order("ord-reset-own", "course:reset-day", "cus-2")],
      enrollments: [
        enrollment("enr-way21", "course-way21", { order_ref: "ord-group" }),
        // Opened through the cohort's order: not Reset Day's own code.
        enrollment("enr-reset-bundle", "course-reset", { order_ref: "ord-group" }),
        // Handed as a bonus: no order at all.
        enrollment("enr-short-bonus", "course-short", { source: "bonus" }),
        // Someone else bought Reset Day for itself.
        enrollment("enr-reset-own", "course-reset", { auth_user_id: "auth-2", order_ref: "ord-reset-own" }),
      ],
    });

    const result = await runDailyReminders(500, NOW, "single-daily-run");

    expect(result).toMatchObject({ scanned: 4, sent: 2, skipped: { held_through_bundle: 2 } });
    expect(nudgedCourses().sort()).toEqual(["/learn/reset-day/day-2", "/learn/way21/day-2"]);
    expect(
      db
        .rows("lms_reminder_log")
        .map((row) => row.enrollment_id)
        .sort(),
    ).toEqual(["enr-reset-own", "enr-way21"]);
  });

  it("matches the seat's order code without regard to case or padding", async () => {
    seed({
      orders: [order("ord-1", " Course:Reset-Day ")],
      enrollments: [enrollment("enr-1", "course-reset", { order_ref: "ord-1" })],
    });
    const result = await runDailyReminders(500, NOW, "single-daily-run");
    expect(result.sent).toBe(1);
  });

  it("does not silence a seat whose order it cannot find, or a manual seat with no order", async () => {
    seed({
      enrollments: [
        enrollment("enr-1", "course-way21", { order_ref: "ord-missing" }),
        enrollment("enr-2", "course-reset", { source: "manual", auth_user_id: "auth-2" }),
      ],
    });
    const result = await runDailyReminders(500, NOW, "single-daily-run");
    expect(result.sent).toBe(2);
  });
});

describe("runDailyReminders — the path", () => {
  it("says so when no published course runs on a daily rhythm", async () => {
    seed();
    catalog = [{ ...WAY21, schedule: { mode: "open" } } as Course, { ...RESET, status: "draft" } as Course];
    expect(await runDailyReminders(500, NOW, "single-daily-run")).toEqual({
      scanned: 0,
      sent: 0,
      skipped: { no_daily_courses: 1 },
    });
  });

  it("stays silent on a seat whose access closed, was revoked, or was blocked", async () => {
    seed({
      enrollments: [
        enrollment("enr-1", "course-way21", { expires_at: "2026-09-25T00:00:00.000Z" }),
        enrollment("enr-2", "course-reset", { status: "revoked" }),
        enrollment("enr-3", "course-short", { blocked_at: "2026-09-20T00:00:00.000Z" }),
      ],
    });
    const result = await runDailyReminders(500, NOW, "single-daily-run");
    expect(result).toMatchObject({ sent: 0, skipped: { access_closed: 3 } });
  });

  it("skips a step already done, and sends the day-1 picture only on day 1", async () => {
    seed({
      enrollments: [
        enrollment("enr-done", "course-way21"),
        enrollment("enr-day1", "course-reset", { started_at: "2026-09-26T06:00:00.000Z" }),
      ],
    });
    db.tables.lms_progress_events = [
      {
        enrollment_id: "enr-done",
        client_id: "c-1",
        type: "lesson.completed",
        lesson_id: "course-way21-m-d2",
        payload: {},
        occurred_at: "2026-09-26T07:00:00.000Z",
      },
    ];

    const result = await runDailyReminders(500, NOW, "single-daily-run");

    expect(result).toMatchObject({ sent: 1, skipped: { already_done: 1 } });
    expect(notifyLearner.mock.calls[0]?.[0]).toMatchObject({ href: "/learn/reset-day/day-1" });
    expect((notifyLearner.mock.calls[0]?.[0] as { imageSrc: string | null }).imageSrc).toBeTruthy();

    // Day 2 of the same course: no picture.
    seed({ enrollments: [enrollment("enr-day2", "course-reset")] });
    notifyLearner.mockClear();
    await runDailyReminders(500, NOW, "single-daily-run");
    expect(notifyLearner.mock.calls[0]?.[0]).toMatchObject({ imageSrc: null });
  });

  it("counts days from the cohort's day 1, not from the seat's first opening", async () => {
    seed({
      enrollments: [
        enrollment("enr-1", "course-way21", { started_at: "2026-09-26T06:00:00.000Z", cohort_starts_on: "2026-09-24" }),
      ],
    });
    await runDailyReminders(500, NOW, "single-daily-run");
    expect(nudgedCourses()).toEqual(["/learn/way21/day-3"]);
  });

  it("claims before sending — a second run the same day sends nothing — and releases on failure", async () => {
    seed({ enrollments: [enrollment("enr-1", "course-way21")] });
    await runDailyReminders(500, NOW, "single-daily-run");
    const again = await runDailyReminders(500, NOW, "single-daily-run");
    expect(again).toMatchObject({ sent: 0, skipped: { already_sent: 1 } });

    seed({ enrollments: [enrollment("enr-1", "course-way21")] });
    notifyLearner.mockResolvedValue({ delivered: false, reason: "no_channel" });
    const failed = await runDailyReminders(500, NOW, "single-daily-run");
    expect(failed.skipped).toMatchObject({ "undelivered:no_channel": 1 });
    expect(db.rows("lms_reminder_log")).toHaveLength(0);
  });

  it("pages past the first slice instead of re-reading the same rows", async () => {
    seed({
      enrollments: ["a", "b", "c", "d", "e"].map((suffix) =>
        enrollment(`enr-${suffix}`, "course-way21", { auth_user_id: `auth-${suffix}` }),
      ),
    });
    const result = await runDailyReminders(2, NOW, "single-daily-run");
    expect(result).toMatchObject({ scanned: 5, sent: 5 });
  });
});

describe("the email fallback", () => {
  const NO_TELEGRAM = { delivered: false, channel: null, reason: "no_reachable_channel" };

  /** auth-1 has an account email and no Telegram; auth-2 has Telegram linked. */
  function seedContacts() {
    db.tables.platform_users = [
      { auth_user_id: "auth-1", timezone: "Europe/Kyiv", email: " Anna@Example.com ", full_name: "Анна Коваль" },
      { auth_user_id: "auth-2", timezone: "Europe/Kyiv", email: "oleh@example.com", full_name: "Олег" },
    ];
    db.tables.customers = [
      { id: "cus-1", auth_user_id: "auth-1", email: "old@example.com", tg_id: null },
      { id: "cus-2", auth_user_id: "auth-2", email: "oleh@example.com", tg_id: "777" },
      { id: "cus-guest", auth_user_id: null },
    ];
  }

  function onWithoutTelegram() {
    vi.stubEnv("LIFECYCLE_EMAILS", "on");
    notifyLearner.mockResolvedValue(NO_TELEGRAM);
  }

  const rowsOn = (table: string, channel: string) => db.rows(table).filter((row) => row.channel === channel);

  it("writes the day's lesson to a learner with no Telegram, once, on its own claim row", async () => {
    seed({ enrollments: [enrollment("enr-1", "course-way21")] });
    seedContacts();
    onWithoutTelegram();

    const result = await runDailyReminders(500, NOW, "single-daily-run");

    expect(result.sent).toBe(0);
    expect(result.email).toMatchObject({ enabled: true, sent: 1 });
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const letter = sendEmail.mock.calls[0]?.[0] as {
      to: string;
      subject: string;
      text: string;
      idempotencyKey: string;
    };
    // The account email, normalised — not the stale one on the customer row.
    expect(letter.to).toBe("anna@example.com");
    expect(letter.subject).toBe("День 2 · way21");
    // The personal host's canonical path, absolute — the same link the Telegram button carries.
    expect(letter.text).toContain("Відкрити урок: https://my.centerway.net.ua/way21/day-2");
    expect(letter.text).toContain("Вітаємо, Анна!");
    expect(letter.idempotencyKey).toBe("lms-reminder-day:enr-1:2");
    expect(rowsOn("lms_reminder_log", "email")).toEqual([
      expect.objectContaining({ enrollment_id: "enr-1", day_number: 2, lesson_id: "course-way21-m-d2" }),
    ]);
    // The Telegram claim was still released: the slot is free if they link it later.
    expect(rowsOn("lms_reminder_log", "telegram")).toHaveLength(0);

    const again = await runDailyReminders(500, NOW, "single-daily-run");
    expect(again.email).toMatchObject({ sent: 0, skipped: { already_sent: 1 } });
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it("does not write to a learner Telegram reached, or to one who has Telegram linked", async () => {
    seed({
      enrollments: [
        enrollment("enr-1", "course-way21"),
        enrollment("enr-2", "course-reset", { auth_user_id: "auth-2" }),
      ],
    });
    seedContacts();
    vi.stubEnv("LIFECYCLE_EMAILS", "on");
    notifyLearner.mockImplementation(async ({ authUserId }: { authUserId: string }) =>
      // auth-1 delivered by Telegram; auth-2 linked but turned Telegram off.
      authUserId === "auth-1" ? { delivered: true, channel: "telegram" } : NO_TELEGRAM,
    );

    const result = await runDailyReminders(500, NOW, "single-daily-run");

    expect(result.sent).toBe(1);
    expect(result.email).toMatchObject({ sent: 0, skipped: { telegram_linked: 1 } });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(rowsOn("lms_reminder_log", "email")).toHaveLength(0);
  });

  it("does not write to a learner whose Telegram send failed for another reason", async () => {
    seed({ enrollments: [enrollment("enr-1", "course-way21")] });
    seedContacts();
    vi.stubEnv("LIFECYCLE_EMAILS", "on");
    notifyLearner.mockResolvedValue({ delivered: false, channel: "telegram", reason: "bot_blocked" });

    const result = await runDailyReminders(500, NOW, "single-daily-run");

    expect(result.email).toMatchObject({ sent: 0, skipped: {} });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends nothing and claims nothing while the switch is off", async () => {
    seed({ enrollments: [enrollment("enr-1", "course-way21")], orders: [order("ord-1", "course:reset-day")] });
    seedContacts();
    notifyLearner.mockResolvedValue(NO_TELEGRAM);

    const daily = await runDailyReminders(500, NOW, "single-daily-run");
    const unstarted = await runUnstartedReminders(500, NOW, "single-daily-run");

    expect(daily.email).toEqual({ enabled: false, sent: 0, skipped: {} });
    expect(unstarted.email).toEqual({ enabled: false, sent: 0, skipped: {} });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(db.rows("lms_reminder_log")).toHaveLength(0);
    expect(db.rows("lms_unstarted_reminders")).toHaveLength(0);
  });

  it("skips a slot already claimed by email, without sending", async () => {
    seed({ enrollments: [enrollment("enr-1", "course-way21")] });
    seedContacts();
    db.tables.lms_reminder_log = [
      { enrollment_id: "enr-1", lesson_id: "course-way21-m-d2", day_number: 2, channel: "email" },
    ];
    onWithoutTelegram();

    const result = await runDailyReminders(500, NOW, "single-daily-run");

    expect(result.email).toMatchObject({ sent: 0, skipped: { already_sent: 1 } });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("releases the email claim when the provider refuses, so the next run tries again", async () => {
    seed({ enrollments: [enrollment("enr-1", "course-way21")] });
    seedContacts();
    onWithoutTelegram();
    sendEmail.mockResolvedValue({ sent: false, reason: "provider_error", detail: "500" });

    const result = await runDailyReminders(500, NOW, "single-daily-run");

    expect(result.email).toMatchObject({ sent: 0, skipped: { "undelivered:provider_error": 1 } });
    expect(rowsOn("lms_reminder_log", "email")).toHaveLength(0);
  });

  it("a mail error is counted, released, and never fails the Telegram pass", async () => {
    seed({ enrollments: [enrollment("enr-1", "course-way21")] });
    seedContacts();
    onWithoutTelegram();
    sendEmail.mockRejectedValue(new Error("boom"));

    const result = await runDailyReminders(500, NOW, "single-daily-run");

    expect(result).toMatchObject({ scanned: 1, email: { sent: 0, skipped: { "error:boom": 1 } } });
    expect(rowsOn("lms_reminder_log", "email")).toHaveLength(0);
  });

  it("respects the suppression list: unsubscribed, bounced or complained is not written to", async () => {
    seed({ enrollments: [enrollment("enr-1", "course-way21")] });
    seedContacts();
    db.tables.messaging_subscriptions = [{ channel: "email", address: "anna@example.com", status: "complained" }];
    onWithoutTelegram();

    const result = await runDailyReminders(500, NOW, "single-daily-run");

    expect(result.email).toMatchObject({ sent: 0, skipped: { "suppressed:complained": 1 } });
    expect(sendEmail).not.toHaveBeenCalled();
    expect(rowsOn("lms_reminder_log", "email")).toHaveLength(0);
  });

  it("leaves day 1 of a group stream to the stream's own letter", async () => {
    seed({
      enrollments: [
        enrollment("enr-1", "course-way21", { started_at: "2026-09-26T06:00:00.000Z", cohort_starts_on: "2026-09-26" }),
      ],
    });
    seedContacts();
    onWithoutTelegram();

    const result = await runDailyReminders(500, NOW, "single-daily-run");

    expect(result.email).toMatchObject({ sent: 0, skipped: { stream_day1_letter: 1 } });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("writes «курс чекає» once per learner and course, however many orders", async () => {
    seed({
      orders: [order("ord-1", "course:reset-day"), order("ord-2", "reset-day", "cus-1", "2026-09-23T09:00:00.000Z")],
    });
    seedContacts();
    onWithoutTelegram();

    const result = await runUnstartedReminders(500, NOW, "single-daily-run");

    expect(result.email).toMatchObject({ enabled: true, sent: 1 });
    expect(result.skipped).toMatchObject({ duplicate_order: 1 });
    const letter = sendEmail.mock.calls[0]?.[0] as { subject: string; text: string; idempotencyKey: string };
    expect(letter.subject).toBe("«reset-day» вже у вашому кабінеті");
    expect(letter.text).toContain("Почати курс: https://my.centerway.net.ua/reset-day");
    expect(letter.idempotencyKey).toBe("lms-reminder-unstarted:ord-1:1");
    expect(rowsOn("lms_unstarted_reminders", "email")).toEqual([
      expect.objectContaining({ order_ref: "ord-1", nudge_number: 1, course_id: "course-reset" }),
    ]);
    expect(rowsOn("lms_unstarted_reminders", "telegram")).toHaveLength(0);
  });

  it("releases the «курс чекає» claim when the letter does not go", async () => {
    seed({ orders: [order("ord-1", "course:reset-day")] });
    seedContacts();
    onWithoutTelegram();
    sendEmail.mockResolvedValue({ sent: false, reason: "missing_api_key" });

    const result = await runUnstartedReminders(500, NOW, "single-daily-run");

    expect(result.email).toMatchObject({ sent: 0, skipped: { "undelivered:missing_api_key": 1 } });
    expect(db.rows("lms_unstarted_reminders")).toHaveLength(0);
  });
});
