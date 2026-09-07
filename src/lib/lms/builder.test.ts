import { describe, expect, it, vi } from "vitest";

import { FakeSupabase } from "@/lib/admin/fakeSupabase";
import { courseRows } from "./authoring";
import { getSnapshotCourse } from "./catalog";

/**
 * Only `deleteBuilderCourse`'s refusal order is under test here — the rest of
 * `builder.ts` reads and writes the database directly through `adminClient()`
 * and has no fixture layer of its own yet. A mock client is built for exactly
 * the one query path this test needs, so a call the function is not supposed
 * to reach (enrollments, progress) throws instead of silently answering "none".
 */
function mockAdminClientReturning(courseRow: Record<string, unknown> | null) {
  return () => ({
    from(table: string) {
      if (table === "lms_courses") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: courseRow, error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected query against ${table} — a status refusal should have short-circuited first`);
    },
  });
}

vi.mock("@/lib/auth/adminClient", () => ({
  adminClient: vi.fn(),
}));

describe("deleteBuilderCourse", () => {
  it("refuses a published course before touching enrollments", async () => {
    const { adminClient } = await import("@/lib/auth/adminClient");
    const { deleteBuilderCourse } = await import("./builder");

    vi.mocked(adminClient).mockImplementation(
      mockAdminClientReturning({ id: "row-1", status: "published" }) as never,
    );

    await expect(deleteBuilderCourse("way21")).rejects.toThrow("lms_builder_delete_published:way21");
  });

  it("no longer refuses a draft just because a snapshot file exists for it", async () => {
    // THE RULE THAT WENT AWAY (2026-08-29). "way21" ships as
    // data/courses/way21.json, and that used to be a refusal on its own,
    // because `liveCatalog` served the file whenever the row was absent — so a
    // delete republished the course instead of retiring it. The file is a
    // fallback for a FAILED read now, so it cannot resurrect anything, and the
    // rule it justified is gone. The delete proceeds to the enrollment check,
    // which this fixture refuses to answer — reaching it IS the assertion.
    const { adminClient } = await import("@/lib/auth/adminClient");
    const { deleteBuilderCourse } = await import("./builder");

    vi.mocked(adminClient).mockImplementation(
      mockAdminClientReturning({ id: "row-1", status: "draft" }) as never,
    );

    await expect(deleteBuilderCourse("way21")).rejects.toThrow("unexpected query against lms_enrollments");
  });
});

describe("nextDraftTitle", () => {
  it("starts with the plain default and advances beyond gaps without colliding", async () => {
    const { nextDraftTitle } = await import("./builder");
    expect(nextDraftTitle([])).toBe("Новий курс");
    expect(nextDraftTitle(["Новий курс", "Новий курс 2", "Новий курс 4", "Інший курс"])).toBe("Новий курс 5");
  });

  it("matches the default case-insensitively", async () => {
    const { nextDraftTitle } = await import("./builder");
    expect(nextDraftTitle(["новий курс", "НОВИЙ КУРС 2"])).toBe("Новий курс 3");
  });
});

describe("courseSlugCanChange", () => {
  it("allows only an unused hidden draft outside shipped snapshots", async () => {
    const { courseSlugCanChange } = await import("./builder");
    expect(courseSlugCanChange({
      course: { slug: "new-course-k7m4", status: "draft", visibility: "hidden" },
      reviewStatus: "draft",
    })).toBe(true);
    expect(courseSlugCanChange({
      course: { slug: "new-course-k7m4", status: "published", visibility: "hidden" },
      reviewStatus: "approved",
    })).toBe(false);
    expect(courseSlugCanChange({
      course: { slug: "way21", status: "draft", visibility: "hidden" },
      reviewStatus: "draft",
    })).toBe(false);
  });
});

describe("isDraftGeneration", () => {
  it("accepts only non-negative safe integer compare-and-swap tokens", async () => {
    const { isDraftGeneration } = await import("./builder");
    expect(isDraftGeneration(0)).toBe(true);
    expect(isDraftGeneration(42)).toBe(true);
    expect(isDraftGeneration(-1)).toBe(false);
    expect(isDraftGeneration(1.5)).toBe(false);
    expect(isDraftGeneration(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
    expect(isDraftGeneration("4")).toBe(false);
  });
});

describe("writeRequiresPublishApproval", () => {
  it("allows an already-published course to be saved as a pending revision", async () => {
    const { writeRequiresPublishApproval } = await import("./builder");
    expect(writeRequiresPublishApproval({
      liveStatus: "published",
      incomingStatus: "published",
      reviewStatus: "draft",
    })).toBe(false);
  });

  it("still gates a draft becoming the live release", async () => {
    const { writeRequiresPublishApproval } = await import("./builder");
    expect(writeRequiresPublishApproval({
      liveStatus: "draft",
      incomingStatus: "published",
      reviewStatus: "draft",
    })).toBe(true);
    expect(writeRequiresPublishApproval({
      liveStatus: "draft",
      incomingStatus: "published",
      reviewStatus: "approved",
    })).toBe(false);
  });
});

describe("autosave checkpoints", () => {
  /* Автосохранение пишет рабочую копию раз в полторы секунды. Журнал так писать
     нельзя: история из тысячи записей за вечер ничем не отличается от её
     отсутствия. Поэтому точка восстановления редкая и дедуплицированная — и
     решает это база, а не экран. */
  it("не плодит точку на каждое сохранение и не дублирует неизменившийся документ", async () => {
    const { adminClient } = await import("@/lib/auth/adminClient");
    const { saveBuilderCourse } = await import("./builder");
    const live = getSnapshotCourse("reset-day")!;
    const rows = courseRows(live);
    const db = new FakeSupabase({
      lms_courses: [{ ...rows.course, status: "draft", author_id: "author-1", review_status: "draft", draft_generation: 0 }],
      lms_modules: rows.modules,
      lms_lessons: rows.lessons,
    });
    vi.mocked(adminClient).mockImplementation(() => db as never);

    const retitled = (title: string) => ({ ...live, status: "draft" as const, title });

    await saveBuilderCourse(retitled("Перша правка"), 0, { actorId: "author-1" });
    expect(db.rows("lms_course_revisions")).toHaveLength(1);
    expect(db.rows("lms_course_revisions")[0]).toMatchObject({ kind: "autosave_checkpoint", created_by: "author-1" });

    // Друге збереження через секунду — інтервал не минув.
    await saveBuilderCourse(retitled("Друга правка"), 1, { actorId: "author-1" });
    expect(db.rows("lms_course_revisions")).toHaveLength(1);

    // Інтервал минув, але документ той самий, що вже в журналі: нічого фіксувати.
    db.autosaveCheckpointIntervalMs = 0;
    await saveBuilderCourse(retitled("Перша правка"), 2, { actorId: "author-1" });
    expect(db.rows("lms_course_revisions")).toHaveLength(1);

    // Інтервал минув і документ інший — ось тепер точка.
    await saveBuilderCourse(retitled("Третя правка"), 3, { actorId: "author-1" });
    expect(db.rows("lms_course_revisions")).toHaveLength(2);
  });

  /* Миграция применяется руками, поэтому «код есть, SQL ещё нет» — рабочее
     состояние. Автор в нём просто сохраняет, как вчера. */
  it("сохраняет как обычно, когда миграции журнала ещё нет", async () => {
    const { adminClient } = await import("@/lib/auth/adminClient");
    const { saveBuilderCourse } = await import("./builder");
    const live = getSnapshotCourse("reset-day")!;
    const rows = courseRows(live);
    const db = new FakeSupabase({
      lms_courses: [{ ...rows.course, status: "draft", author_id: "author-1", review_status: "draft", draft_generation: 0 }],
      lms_modules: rows.modules,
      lms_lessons: rows.lessons,
    });
    db.journalMigrationApplied = false;
    vi.mocked(adminClient).mockImplementation(() => db as never);

    await expect(saveBuilderCourse({ ...live, status: "draft", title: "Без журналу" }, 0, { actorId: "author-1" }))
      .resolves.toMatchObject({ status: "draft" });
    expect(db.rows("lms_course_revisions")).toHaveLength(0);
  });
});

describe("published course draft persistence", () => {
  it("survives a save and reload without changing the learner release", async () => {
    const { adminClient } = await import("@/lib/auth/adminClient");
    const { loadBuilderCourse, saveBuilderCourse } = await import("./builder");
    const live = getSnapshotCourse("reset-day")!;
    const rows = courseRows(live);
    const db = new FakeSupabase({
      lms_courses: [{
        ...rows.course,
        author_id: "author-1",
        review_status: "approved",
        review_note: null,
        pending_content: null,
        pending_review_status: null,
        draft_generation: 0,
        updated_at: "2026-08-24T00:00:00.000Z",
      }],
      lms_modules: rows.modules,
      lms_lessons: rows.lessons,
    });
    vi.mocked(adminClient).mockImplementation(() => db as never);

    const editedTitle = `${live.modules[0].lessons[0].title} · чернетка`;
    const edited = {
      ...live,
      modules: live.modules.map((module, moduleIndex) => moduleIndex === 0
        ? {
            ...module,
            lessons: module.lessons.map((lesson, lessonIndex) => lessonIndex === 0
              ? { ...lesson, title: editedTitle }
              : lesson),
          }
        : module),
    };

    await expect(saveBuilderCourse(edited, 0)).resolves.toMatchObject({
      status: "draft",
      staged: true,
      draftGeneration: 1,
    });

    const storedRelease = db.rows("lms_courses")[0];
    expect(storedRelease.title).toBe(live.title);
    expect(storedRelease.status).toBe("published");
    expect(storedRelease.pending_content).toMatchObject({ status: "draft" });

    const reopened = await loadBuilderCourse(live.slug);
    expect(reopened).toMatchObject({
      liveStatus: "published",
      hasPendingRevision: true,
      draftGeneration: 1,
    });
    expect(reopened?.liveCourse.modules[0].lessons[0].title).toBe(live.modules[0].lessons[0].title);
    expect(reopened?.course.modules[0].lessons[0].title).toBe(editedTitle);
  });
});

/**
 * THE ACCESS CODES ARE GOVERNED, NOT AUTHORED.
 *
 * `entitlementProductCodes` decides which paid orders open the course
 * (`resolveEntitlement`), so an author who could write it could seat every
 * buyer of somebody else's funnel in their own course. The payload carries the
 * field either way — the client sends a whole Course — so the write is what
 * has to hold the line, and it holds it by PRESERVING rather than refusing: a
 * stale client must not start failing saves.
 */
describe("access code governance", () => {
  async function saveWithCodes(codes: string[], governance?: { mayGovernAccessCodes: boolean }) {
    const { adminClient } = await import("@/lib/auth/adminClient");
    const { saveBuilderCourse } = await import("./builder");
    const live = getSnapshotCourse("reset-day")!;
    const rows = courseRows(live);
    const db = new FakeSupabase({
      lms_courses: [{
        ...rows.course,
        entitlement_product_codes: ["reset-day", "mini-detox"],
        author_id: "author-1",
        review_status: "approved",
        review_note: null,
        pending_content: null,
        pending_review_status: null,
        draft_generation: 0,
        updated_at: "2026-08-24T00:00:00.000Z",
      }],
      lms_modules: rows.modules,
      lms_lessons: rows.lessons,
    });
    vi.mocked(adminClient).mockImplementation(() => db as never);

    await saveBuilderCourse({ ...live, entitlementProductCodes: codes }, 0, governance);
    const stored = db.rows("lms_courses")[0];
    return (stored.pending_content as { entitlementProductCodes: string[] }).entitlementProductCodes;
  }

  it("keeps the stored codes when the writer may not govern them", async () => {
    expect(await saveWithCodes(["way21", "reset-day", "mini-detox"])).toEqual(["reset-day", "mini-detox"]);
  });

  it("lets an owner move them", async () => {
    expect(await saveWithCodes(["reset-day"], { mayGovernAccessCodes: true })).toEqual(["reset-day"]);
  });
});
