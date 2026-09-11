import { describe, expect, it } from "vitest";

import { buildJournalEntries, groupJournalByDay, type JournalMark, type JournalPlace } from "./journal";

function mark(overrides: Partial<JournalMark> = {}): JournalMark {
  return {
    clientId: "m1",
    enrollmentId: "e1",
    lessonId: "l1",
    kind: "highlight",
    quote: "теплої води вранці",
    note: null,
    blockId: "b7",
    createdAt: "2026-09-10T09:00:00.000Z",
    updatedAt: "2026-09-10T09:00:00.000Z",
    ...overrides,
  };
}

const place: JournalPlace = {
  enrollmentId: "e1",
  courseSlug: "way21",
  courseTitle: "Шлях 21",
  open: true,
  lessons: [{ id: "l1", slug: "day-1", title: "День 1" }],
};

describe("the journal's entries", () => {
  it("names the course and the lesson, and links into the block", () => {
    const [entry] = buildJournalEntries([mark()], [place]);

    expect(entry.course).toEqual({ slug: "way21", title: "Шлях 21", open: true });
    expect(entry.lesson).toEqual({ slug: "day-1", title: "День 1" });
    expect(entry.path).toBe("/learn/way21/day-1#block-b7");
  });

  it("links to the lesson itself when the mark is a bookmark", () => {
    const [entry] = buildJournalEntries(
      [mark({ kind: "bookmark", blockId: null, quote: null })],
      [place]
    );

    expect(entry.path).toBe("/learn/way21/day-1");
  });

  it("runs newest first, on when it was WRITTEN", () => {
    const entries = buildJournalEntries(
      [
        mark({ clientId: "old", createdAt: "2026-09-01T08:00:00.000Z" }),
        /* Edited long after it was written. A journal records the writing, so
           this must not jump the queue. */
        mark({
          clientId: "middle",
          createdAt: "2026-09-05T08:00:00.000Z",
          updatedAt: "2026-09-30T08:00:00.000Z",
        }),
        mark({ clientId: "new", createdAt: "2026-09-09T08:00:00.000Z" }),
      ],
      [place]
    );

    expect(entries.map((entry) => entry.clientId)).toEqual(["new", "middle", "old"]);
  });

  it("keeps a mark whose lesson can no longer be named, and only drops its link", () => {
    const [entry] = buildJournalEntries([mark({ lessonId: "gone" })], [place]);

    expect(entry.quote).toBe("теплої води вранці");
    expect(entry.lesson).toBeNull();
    expect(entry.path).toBeNull();
    // The course is still nameable through the enrollment.
    expect(entry.course?.title).toBe("Шлях 21");
  });

  it("keeps a mark whose course is gone entirely", () => {
    const [entry] = buildJournalEntries([mark()], []);

    expect(entry.quote).toBe("теплої води вранці");
    expect(entry.course).toBeNull();
    expect(entry.path).toBeNull();
  });

  it("shows a closed window rather than hiding what was written inside it", () => {
    const [entry] = buildJournalEntries([mark()], [{ ...place, open: false }]);

    expect(entry.course?.open).toBe(false);
    // Access ended for the course, not for the reader's own words: the link
    // still stands and the door decides.
    expect(entry.path).toBe("/learn/way21/day-1#block-b7");
  });

  it("does not read one enrollment's lesson through another's", () => {
    const second: JournalPlace = {
      enrollmentId: "e2",
      courseSlug: "reset-day",
      courseTitle: "День перезапуску",
      open: true,
      // Same lesson id, different course — the shape a re-purchase produces.
      lessons: [{ id: "l1", slug: "start", title: "Початок" }],
    };

    const entries = buildJournalEntries(
      [mark({ clientId: "a", enrollmentId: "e1" }), mark({ clientId: "b", enrollmentId: "e2" })],
      [place, second]
    );

    expect(entries.find((entry) => entry.clientId === "a")?.path).toBe("/learn/way21/day-1#block-b7");
    expect(entries.find((entry) => entry.clientId === "b")?.path).toBe("/learn/reset-day/start#block-b7");
  });
});

describe("the journal's days", () => {
  it("cuts on the READER's calendar, not on UTC", () => {
    const entries = buildJournalEntries(
      [
        // 00:30 in Kyiv on the 11th; still the 10th in UTC.
        mark({ clientId: "night", createdAt: "2026-09-10T21:30:00.000Z" }),
        mark({ clientId: "morning", createdAt: "2026-09-10T06:00:00.000Z" }),
      ],
      [place]
    );

    const days = groupJournalByDay(entries, "Europe/Kyiv");

    expect(days.map((day) => day.date)).toEqual(["2026-09-11", "2026-09-10"]);
    expect(days[0].entries.map((entry) => entry.clientId)).toEqual(["night"]);
  });

  it("puts consecutive entries of one day in one group", () => {
    const entries = buildJournalEntries(
      [
        mark({ clientId: "a", createdAt: "2026-09-10T06:00:00.000Z" }),
        mark({ clientId: "b", createdAt: "2026-09-10T07:00:00.000Z" }),
      ],
      [place]
    );

    const days = groupJournalByDay(entries, "Europe/Kyiv");

    expect(days).toHaveLength(1);
    expect(days[0].entries).toHaveLength(2);
  });

  it("keeps an entry whose timestamp cannot be read", () => {
    const entries = buildJournalEntries([mark({ createdAt: "not-a-date" })], [place]);
    const days = groupJournalByDay(entries, "Europe/Kyiv");

    expect(days).toHaveLength(1);
    expect(days[0].date).toBe("");
    expect(days[0].entries).toHaveLength(1);
  });
});
