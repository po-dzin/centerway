import { describe, expect, it } from "vitest";

import { validateLessonBlock, collectRequiredChecklistItemIds, youtubeIdFrom } from "./blocks";
import { validateCourse, flattenLessons, type Course } from "./course";
import { calendarDaysBetween, enrollmentDayNumber, localHour, resolveTimeZone } from "./time";
import { foldProgress, checklistSatisfied, type ProgressEvent } from "./progress";
import {
  buildOutline,
  canCompleteLesson,
  decideDailyReminder,
  decideUnstartedReminder,
  lessonAvailability,
  resolveCurrentLesson,
} from "./schedule";
import { resolveEntitlement } from "./access";

function dailyCourse(): Course {
  const course = {
    id: "course-test",
    slug: "test-course",
    title: "Test course",
    programSlug: "reset-day",
    brand: "centerway",
    locale: "uk",
    translationGroupId: "grp-test",
    status: "published",
    version: 1,
    schedule: { mode: "daily", start: "purchase", reminderHour: 9 },
    entitlementProductCodes: ["reset-day", "mini-detox"],
    modules: [
      {
        id: "m1",
        slug: "m1",
        title: "Module 1",
        order: 1,
        lessons: [
          {
            id: "l1",
            slug: "day-1",
            title: "Day 1",
            order: 1,
            dayIndex: 1,
            blocks: [
              { id: "b1", type: "lesson_objective", text: "Objective" },
              {
                id: "b2",
                type: "checklist",
                requiredForCompletion: true,
                items: [
                  { id: "c1", text: "First" },
                  { id: "c2", text: "Second" },
                ],
              },
            ],
          },
          {
            id: "l2",
            slug: "day-2",
            title: "Day 2",
            order: 2,
            dayIndex: 2,
            blocks: [{ id: "b3", type: "lesson_objective", text: "Objective 2" }],
          },
        ],
      },
    ],
  };
  validateCourse(course);
  return course;
}

describe("block validation", () => {
  it("accepts a well-formed rich_text block", () => {
    expect(() =>
      validateLessonBlock(
        {
          id: "b",
          type: "rich_text",
          content: [
            { kind: "p", text: "plain" },
            { kind: "p", text: [{ text: "bold bit", bold: true }] },
            { kind: "ul", items: ["one", "two"] },
          ],
        },
        "test"
      )
    ).not.toThrow();
  });

  it("rejects an image without alt text", () => {
    expect(() => validateLessonBlock({ id: "b", type: "image", src: "/a.webp" }, "test")).toThrow(
      /lms_block_missing_image_alt/
    );
  });

  it("rejects an unknown block type", () => {
    expect(() => validateLessonBlock({ id: "b", type: "iframe_embed" }, "test")).toThrow(
      /lms_block_unknown_type/
    );
  });

  it("rejects duplicate checklist item ids", () => {
    expect(() =>
      validateLessonBlock(
        { id: "b", type: "checklist", items: [{ id: "x", text: "a" }, { id: "x", text: "b" }] },
        "test"
      )
    ).toThrow(/lms_block_checklist_duplicate_item_id/);
  });

  it("rejects a non-youtube video provider while the decision stands", () => {
    expect(() => validateLessonBlock({ id: "b", type: "video", provider: "mux", videoId: "x" }, "t")).toThrow(
      /lms_block_unsupported_video_provider/
    );
  });
});

describe("course validation", () => {
  it("requires a dayIndex on every lesson of a daily course", () => {
    const course = dailyCourse() as unknown as Record<string, unknown>;
    const modules = course.modules as Array<{ lessons: Array<Record<string, unknown>> }>;
    delete modules[0].lessons[1].dayIndex;
    expect(() => validateCourse(course)).toThrow(/lms_lesson_missing_day_index/);
  });

  it("rejects duplicate lesson slugs across modules", () => {
    const course = dailyCourse() as unknown as Record<string, unknown>;
    const modules = course.modules as Array<{ lessons: Array<Record<string, unknown>> }>;
    modules[0].lessons[1].slug = "day-1";
    expect(() => validateCourse(course)).toThrow(/lms_lesson_duplicate_slug/);
  });

  it("walks lessons in module then lesson order", () => {
    expect(flattenLessons(dailyCourse()).map((entry) => entry.lesson.slug)).toEqual(["day-1", "day-2"]);
  });
});

describe("timezone math", () => {
  it("falls back to Kyiv for an unknown zone", () => {
    expect(resolveTimeZone("Mars/Olympus")).toBe("Europe/Kyiv");
    expect(resolveTimeZone("")).toBe("Europe/Kyiv");
    expect(resolveTimeZone("America/Vancouver")).toBe("America/Vancouver");
  });

  it("counts calendar days, not elapsed hours", () => {
    // 23:30 Kyiv to 00:30 Kyiv is one calendar day, though only an hour passed.
    const from = new Date("2026-08-15T20:30:00Z"); // 23:30 Kyiv (UTC+3)
    const to = new Date("2026-08-15T21:30:00Z"); // 00:30 Kyiv, next day
    expect(calendarDaysBetween(from, to, "Europe/Kyiv")).toBe(1);
  });

  it("gives different day numbers in different zones for the same instant", () => {
    // Start maps to Aug 15 in BOTH zones (15:00 Kyiv / 05:00 Vancouver)…
    const startedAt = new Date("2026-08-15T12:00:00Z");
    // …but by this instant only Kyiv has rolled over to the 16th (00:30 vs 14:30).
    const now = new Date("2026-08-15T21:30:00Z");
    expect(enrollmentDayNumber(startedAt, now, "Europe/Kyiv")).toBe(2);
    expect(enrollmentDayNumber(startedAt, now, "America/Vancouver")).toBe(1);
  });

  it("treats the start day as day 1", () => {
    const startedAt = new Date("2026-08-15T06:00:00Z");
    expect(enrollmentDayNumber(startedAt, startedAt, "Europe/Kyiv")).toBe(1);
  });

  it("reads the local hour per zone", () => {
    const instant = new Date("2026-08-15T06:00:00Z");
    expect(localHour(instant, "Europe/Kyiv")).toBe(9);
    expect(localHour(instant, "America/Vancouver")).toBe(23);
  });
});

describe("progress fold", () => {
  const events: ProgressEvent[] = [
    { clientId: "e1", type: "lesson.started", lessonId: "l1", occurredAt: "2026-08-15T06:00:00Z" },
    {
      clientId: "e2",
      type: "checklist.toggled",
      lessonId: "l1",
      occurredAt: "2026-08-15T06:05:00Z",
      payload: { itemId: "c1", checked: true },
    },
    { clientId: "e3", type: "lesson.completed", lessonId: "l1", occurredAt: "2026-08-15T06:10:00Z" },
  ];

  it("folds events into lesson state", () => {
    const progress = foldProgress(events);
    expect(progress.lessons.l1.status).toBe("completed");
    expect(progress.lessons.l1.checklist.c1).toBe(true);
    expect(progress.completedLessonIds).toEqual(["l1"]);
  });

  it("is idempotent — a replayed offline flush changes nothing", () => {
    expect(foldProgress([...events, ...events])).toEqual(foldProgress(events));
  });

  it("is order-independent", () => {
    expect(foldProgress([...events].reverse())).toEqual(foldProgress(events));
  });

  it("never un-completes a lesson that is reopened", () => {
    const progress = foldProgress([
      ...events,
      { clientId: "e4", type: "lesson.started", lessonId: "l1", occurredAt: "2026-08-16T06:00:00Z" },
    ]);
    expect(progress.lessons.l1.status).toBe("completed");
  });

  it("un-completes on an explicit event, keeping the checklist intact", () => {
    const progress = foldProgress([
      ...events,
      { clientId: "e5", type: "lesson.uncompleted", lessonId: "l1", occurredAt: "2026-08-16T06:00:00Z" },
    ]);
    expect(progress.lessons.l1.status).toBe("started");
    expect(progress.lessons.l1.completedAt).toBeNull();
    expect(progress.completedLessonIds).toEqual([]);
    // Un-ticking the step must not silently discard the learner's answers.
    expect(progress.lessons.l1.checklist.c1).toBe(true);
  });

  it("re-completes after un-completing, and re-stamps completedAt", () => {
    const progress = foldProgress([
      ...events,
      { clientId: "e5", type: "lesson.uncompleted", lessonId: "l1", occurredAt: "2026-08-16T06:00:00Z" },
      { clientId: "e6", type: "lesson.completed", lessonId: "l1", occurredAt: "2026-08-17T06:00:00Z" },
    ]);
    expect(progress.lessons.l1.status).toBe("completed");
    // The second pass reports when IT finished, not when the first one did.
    expect(progress.lessons.l1.completedAt).toBe("2026-08-17T06:00:00Z");
  });

  it("resolves completion by occurredAt, not by arrival order", () => {
    const log: ProgressEvent[] = [
      ...events,
      { clientId: "e5", type: "lesson.uncompleted", lessonId: "l1", occurredAt: "2026-08-16T06:00:00Z" },
    ];
    // An offline client flushing out of order must converge on the same state.
    expect(foldProgress([...log].reverse())).toEqual(foldProgress(log));
  });

  it("applies last-write-wins per checklist item", () => {
    const progress = foldProgress([
      {
        clientId: "a",
        type: "checklist.toggled",
        lessonId: "l1",
        occurredAt: "2026-08-15T07:00:00Z",
        payload: { itemId: "c1", checked: true },
      },
      {
        clientId: "b",
        type: "checklist.toggled",
        lessonId: "l1",
        occurredAt: "2026-08-15T08:00:00Z",
        payload: { itemId: "c1", checked: false },
      },
    ]);
    expect(progress.lessons.l1.checklist.c1).toBe(false);
  });

  it("treats an empty requirement list as satisfied", () => {
    expect(checklistSatisfied(foldProgress([]), "l1", [])).toBe(true);
  });
});

describe("drip availability", () => {
  const course = dailyCourse();
  const startedAt = new Date("2026-08-15T06:00:00Z");

  it("opens day 2 ahead of its day, and says how far ahead it is", () => {
    // The default gate is soft: the schedule paces the course, it does not lock
    // it. Someone on day 1 must be able to read week 3 — that is how they know
    // what to order before it is needed.
    const context = { startedAt, timeZone: "Europe/Kyiv", now: startedAt };
    const progress = foldProgress([]);
    const [day1, day2] = flattenLessons(course).map((entry) => entry.lesson);

    expect(lessonAvailability(course, day1, progress, context)).toEqual({ available: true });
    expect(lessonAvailability(course, day2, progress, context)).toEqual({
      available: true,
      ahead: { reason: "before_day", scheduledDay: 2, daysAhead: 1 },
    });
  });

  it("locks day 2 when the course asks for a hard gate", () => {
    const strict = { ...course, schedule: { ...course.schedule, gate: "hard" as const } };
    const context = { startedAt, timeZone: "Europe/Kyiv", now: startedAt };
    const progress = foldProgress([]);
    const [day1, day2] = flattenLessons(strict).map((entry) => entry.lesson);

    expect(lessonAvailability(strict, day1, progress, context).available).toBe(true);
    expect(lessonAvailability(strict, day2, progress, context)).toEqual({
      available: false,
      reason: "locked_by_day",
      unlocksOnDay: 2,
      daysRemaining: 1,
    });
  });

  it("keeps `continue` on the day the learner has actually reached", () => {
    // Day 2 is open (soft gate) but it is not where the protocol says to be, so
    // the course entry point must still point at day 1.
    const context = { startedAt, timeZone: "Europe/Kyiv", now: startedAt };
    expect(resolveCurrentLesson(course, foldProgress([]), context)?.slug).toBe("day-1");
  });

  it("points ahead once everything the schedule opened is done", () => {
    const context = { startedAt, timeZone: "Europe/Kyiv", now: startedAt };
    const done = foldProgress([
      {
        clientId: "d1",
        type: "lesson.completed",
        lessonId: "l1",
        occurredAt: "2026-08-15T07:00:00Z",
      },
    ]);
    expect(resolveCurrentLesson(course, done, context)?.slug).toBe("day-2");
  });

  it("unlocks day 2 once the learner's local date rolls over", () => {
    const context = {
      startedAt,
      timeZone: "Europe/Kyiv",
      now: new Date("2026-08-16T06:00:00Z"),
    };
    const day2 = flattenLessons(course)[1].lesson;
    expect(lessonAvailability(course, day2, foldProgress([]), context).available).toBe(true);
  });

  it("blocks completion until required checklist items are ticked", () => {
    const context = { startedAt, timeZone: "Europe/Kyiv", now: startedAt };
    const day1 = flattenLessons(course)[0].lesson;

    expect(canCompleteLesson(course, day1, foldProgress([]), context)).toEqual({
      allowed: false,
      reason: "checklist_incomplete",
    });

    const ticked = foldProgress([
      {
        clientId: "t1",
        type: "checklist.toggled",
        lessonId: "l1",
        occurredAt: "2026-08-15T06:01:00Z",
        payload: { itemId: "c1", checked: true },
      },
      {
        clientId: "t2",
        type: "checklist.toggled",
        lessonId: "l1",
        occurredAt: "2026-08-15T06:02:00Z",
        payload: { itemId: "c2", checked: true },
      },
    ]);
    expect(canCompleteLesson(course, day1, ticked, context)).toEqual({ allowed: true });
  });

  it("points a fresh learner at day 1", () => {
    const context = { startedAt, timeZone: "Europe/Kyiv", now: startedAt };
    expect(resolveCurrentLesson(course, foldProgress([]), context)?.slug).toBe("day-1");
  });

  it("builds an outline carrying schedule position and completion state", () => {
    const context = { startedAt, timeZone: "Europe/Kyiv", now: startedAt };
    const outline = buildOutline(course, foldProgress([]), context);
    expect(outline).toHaveLength(2);
    expect(outline[0].availability).toEqual({ available: true });
    expect(outline[1].availability.available).toBe(true);
    expect(outline[1].availability.available && outline[1].availability.ahead?.reason).toBe("before_day");
  });

  it("collects checklist items that gate completion", () => {
    const day1 = flattenLessons(course)[0].lesson;
    expect(collectRequiredChecklistItemIds(day1.blocks)).toEqual(["c1", "c2"]);
  });
});

describe("daily reminder decision", () => {
  const course = dailyCourse();
  const startedAt = new Date("2026-08-15T06:00:00Z");

  it("fires at the learner's local reminder hour, not the server's", () => {
    // 06:00Z is 09:00 in Kyiv — the configured reminder hour.
    const decision = decideDailyReminder(course, foldProgress([]), {
      startedAt,
      timeZone: "Europe/Kyiv",
      now: new Date("2026-08-15T06:00:00Z"),
    });
    expect(decision).toMatchObject({ send: true, dayNumber: 1 });
  });

  it("stays silent at the same instant for a learner in another zone", () => {
    // The same instant is 23:00 in Vancouver — nobody gets woken up.
    const decision = decideDailyReminder(course, foldProgress([]), {
      startedAt,
      timeZone: "America/Vancouver",
      now: new Date("2026-08-15T06:00:00Z"),
    });
    expect(decision).toEqual({ send: false, reason: "wrong_hour" });
  });

  it("stays silent when the day's lesson is already done", () => {
    const progress = foldProgress([
      { clientId: "d1", type: "lesson.completed", lessonId: "l1", occurredAt: "2026-08-15T05:00:00Z" },
    ]);
    expect(
      decideDailyReminder(course, progress, {
        startedAt,
        timeZone: "Europe/Kyiv",
        now: new Date("2026-08-15T06:00:00Z"),
      })
    ).toEqual({ send: false, reason: "already_done" });
  });

  it("reports the course as finished past the last day", () => {
    expect(
      decideDailyReminder(course, foldProgress([]), {
        startedAt,
        timeZone: "Europe/Kyiv",
        now: new Date("2026-08-20T06:00:00Z"),
      })
    ).toEqual({ send: false, reason: "finished" });
  });

  // The daily-cron policy. Under it the Vancouver learner above IS reminded at
  // the same instant, because a once-a-day job that keeps the local-hour test
  // reminds almost nobody — the point of the policy is that it is loud, not
  // that it is polite.
  it("under a single daily run, delivers regardless of the learner's local hour", () => {
    const decision = decideDailyReminder(course, foldProgress([]), {
      startedAt,
      timeZone: "America/Vancouver",
      now: new Date("2026-08-15T06:00:00Z"),
      hourPolicy: "single-daily-run",
    });
    expect(decision).toMatchObject({ send: true });
  });

  it("under a single daily run, still counts the day in the learner's own zone", () => {
    // One instant, two learners, two different days of the same course.
    // Access began 2026-08-15T06:00Z — the 15th in Kyiv, still the evening of
    // the 14th in Vancouver. At 20:00Z on the 15th it is late on the 15th in
    // Kyiv (day 1) but midday on the 15th in Vancouver, whose day 1 was the
    // 14th (day 2). Dropping the hour must not drag the calendar with it.
    const at = new Date("2026-08-15T20:00:00Z");
    const vancouver = decideDailyReminder(course, foldProgress([]), {
      startedAt,
      timeZone: "America/Vancouver",
      now: at,
      hourPolicy: "single-daily-run",
    });
    const kyiv = decideDailyReminder(course, foldProgress([]), {
      startedAt,
      timeZone: "Europe/Kyiv",
      now: at,
      hourPolicy: "single-daily-run",
    });
    expect(vancouver).toMatchObject({ send: true, dayNumber: 2, lesson: { slug: "day-2" } });
    expect(kyiv).toMatchObject({ send: true, dayNumber: 1, lesson: { slug: "day-1" } });
  });

  it("still honours an already-done lesson under the daily policy", () => {
    const progress = foldProgress([
      { clientId: "d1", type: "lesson.completed", lessonId: "l1", occurredAt: "2026-08-15T05:00:00Z" },
    ]);
    expect(
      decideDailyReminder(course, progress, {
        startedAt,
        timeZone: "America/Vancouver",
        now: new Date("2026-08-15T06:00:00Z"),
        hourPolicy: "single-daily-run",
      })
    ).toEqual({ send: false, reason: "already_done" });
  });
});

describe("unstarted nudge decision", () => {
  const course = dailyCourse();
  // 06:00Z is 09:00 in Kyiv — the configured reminder hour.
  const purchasedAt = new Date("2026-08-15T06:00:00Z");
  const base = { purchasedAt, timeZone: "Europe/Kyiv", sentNudgeNumbers: [] as number[] };

  it("stays silent on the purchase day and the day after", () => {
    expect(decideUnstartedReminder(course, { ...base, now: new Date("2026-08-15T06:00:00Z") })).toEqual({
      send: false,
      reason: "too_early",
    });
    // Day 2 in this codebase's counting is the calendar day AFTER the start,
    // so a Friday purchase is still untouched on Friday.
    expect(decideUnstartedReminder(course, { ...base, now: new Date("2026-08-16T06:00:00Z") })).toMatchObject({
      send: true,
      nudgeNumber: 1,
    });
  });

  it("fires the second nudge only after the first is recorded", () => {
    const atDay7 = { ...base, now: new Date("2026-08-21T06:00:00Z") };
    // Nothing sent yet: the FIRST unsent nudge wins, never the latest due one.
    expect(decideUnstartedReminder(course, atDay7)).toMatchObject({ send: true, nudgeNumber: 1 });
    expect(decideUnstartedReminder(course, { ...atDay7, sentNudgeNumbers: [1] })).toMatchObject({
      send: true,
      nudgeNumber: 2,
    });
  });

  it("goes quiet for good after the last nudge", () => {
    expect(
      decideUnstartedReminder(course, {
        ...base,
        now: new Date("2026-09-30T06:00:00Z"),
        sentNudgeNumbers: [1, 2],
      })
    ).toEqual({ send: false, reason: "all_sent" });
  });

  it("recovers a nudge whose cron hour was missed", () => {
    // Day 4: the day-2 slot came and went while the job was down. The nudge is
    // late rather than lost.
    expect(decideUnstartedReminder(course, { ...base, now: new Date("2026-08-18T06:00:00Z") })).toMatchObject({
      send: true,
      nudgeNumber: 1,
    });
  });

  it("respects the buyer's clock, not the server's", () => {
    // Same instant, Vancouver — 23:00 locally, nobody gets woken up.
    expect(
      decideUnstartedReminder(course, {
        ...base,
        timeZone: "America/Vancouver",
        now: new Date("2026-08-16T06:00:00Z"),
      })
    ).toEqual({ send: false, reason: "wrong_hour" });
  });

  it("under a single daily run, reaches the buyer outside the reminder hour", () => {
    expect(
      decideUnstartedReminder(course, {
        ...base,
        timeZone: "America/Vancouver",
        now: new Date("2026-08-16T06:00:00Z"),
        hourPolicy: "single-daily-run",
      })
    ).toMatchObject({ send: true, nudgeNumber: 1 });
  });

  it("never pushes a draft course, daily policy included", () => {
    const draft = { ...dailyCourse(), status: "draft" as const };
    expect(
      decideUnstartedReminder(draft, {
        ...base,
        now: new Date("2026-08-16T06:00:00Z"),
        hourPolicy: "single-daily-run",
      })
    ).toEqual({ send: false, reason: "not_published" });
    expect(decideUnstartedReminder(draft, { ...base, now: new Date("2026-08-16T06:00:00Z") })).toEqual({
      send: false,
      reason: "not_published",
    });
  });
});

describe("entitlement", () => {
  const now = new Date("2026-08-15T06:00:00Z");
  const base = { courseProductCodes: ["reset-day", "mini-detox"], courseSlug: "reset-day", now };

  it("grants access from a paid order under a legacy product code", () => {
    const result = resolveEntitlement({
      ...base,
      orders: [{ orderRef: "o1", productCode: "Mini-Detox", status: "paid", createdAt: "2026-08-01T10:00:00Z" }],
      tokens: [],
    });
    expect(result).toMatchObject({ entitled: true, source: "order", orderRef: "o1" });
  });

  it("refuses access without a paid order", () => {
    const result = resolveEntitlement({
      ...base,
      orders: [{ orderRef: "o1", productCode: "reset-day", status: "created", createdAt: "2026-08-01T10:00:00Z" }],
      tokens: [],
    });
    expect(result).toEqual({ entitled: false, reason: "no_paid_order" });
  });

  it("ignores an unrelated product", () => {
    const result = resolveEntitlement({
      ...base,
      orders: [{ orderRef: "o1", productCode: "herbs", status: "paid", createdAt: "2026-08-01T10:00:00Z" }],
      tokens: [],
    });
    expect(result).toEqual({ entitled: false, reason: "no_paid_order" });
  });

  it("treats an expired token as expired access", () => {
    const result = resolveEntitlement({
      ...base,
      orders: [{ orderRef: "o1", productCode: "reset-day", status: "paid", createdAt: "2026-08-01T10:00:00Z" }],
      tokens: [{ orderRef: "o1", used: true, expiresAt: "2026-08-10T00:00:00Z" }],
    });
    expect(result).toEqual({ entitled: false, reason: "expired" });
  });

  it("honours a manual grant without any order", () => {
    const result = resolveEntitlement({
      ...base,
      orders: [],
      tokens: [],
      manualGrants: [{ courseSlug: "reset-day", grantedAt: "2026-08-05T00:00:00Z" }],
    });
    expect(result).toMatchObject({ entitled: true, source: "manual" });
  });
});

describe("youtubeIdFrom", () => {
  const ID = "dQw4w9WgXcQ";

  it("takes the identifier out of every link shape someone actually copies", () => {
    expect(youtubeIdFrom(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID);
    expect(youtubeIdFrom(`https://youtu.be/${ID}`)).toBe(ID);
    expect(youtubeIdFrom(`https://www.youtube.com/embed/${ID}`)).toBe(ID);
    expect(youtubeIdFrom(`https://www.youtube.com/shorts/${ID}`)).toBe(ID);
    expect(youtubeIdFrom(`https://www.youtube.com/live/${ID}`)).toBe(ID);
  });

  it("keeps the extra query parameters out of it", () => {
    expect(youtubeIdFrom(`https://www.youtube.com/watch?v=${ID}&t=42s&list=PLabc`)).toBe(ID);
    expect(youtubeIdFrom(`https://youtu.be/${ID}?t=42`)).toBe(ID);
  });

  it("still accepts a bare identifier, because that is what the field used to hold", () => {
    expect(youtubeIdFrom(ID)).toBe(ID);
    expect(youtubeIdFrom(`  ${ID}  `)).toBe(ID);
  });

  it("returns null rather than a guess when nothing looks like one", () => {
    expect(youtubeIdFrom("")).toBeNull();
    expect(youtubeIdFrom("https://vimeo.com/12345")).toBeNull();
    expect(youtubeIdFrom("не посилання")).toBeNull();
  });
});
