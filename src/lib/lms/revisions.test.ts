import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Course } from "@/lms-core";
import { FakeSupabase } from "@/lib/admin/fakeSupabase";
import { courseRevisionHash, listLessonRevisions } from "./revisions";

vi.mock("@/lib/auth/adminClient", () => ({ adminClient: vi.fn() }));

describe("course revision hash", () => {
  it("is stable across object key order", () => {
    const left = { id: "course", title: "Курс", modules: [{ id: "m", title: "Модуль" }] } as unknown as Course;
    const right = { modules: [{ title: "Модуль", id: "m" }], title: "Курс", id: "course" } as unknown as Course;
    expect(courseRevisionHash(left)).toBe(courseRevisionHash(right));
  });

  /* Иначе дедупликация точек восстановления не сработала бы ни разу: каждое
     сохранение двигает `version`, и документ без единой правки приходил бы с
     новым отпечатком. */
  it("ignores the version counter, which every save increments", () => {
    const before = { id: "course", title: "Курс", version: 12 } as unknown as Course;
    const after = { id: "course", title: "Курс", version: 13 } as unknown as Course;
    expect(courseRevisionHash(before)).toBe(courseRevisionHash(after));
  });

  it("changes when ordered content changes", () => {
    const first = { id: "course", modules: ["a", "b"] } as unknown as Course;
    const second = { id: "course", modules: ["b", "a"] } as unknown as Course;
    expect(courseRevisionHash(first)).not.toBe(courseRevisionHash(second));
  });
});

describe("история одного урока", () => {
  /* Отдельной таблицы версий урока нет намеренно: урок не самостоятелен, и две
     независимые истории разошлись бы в первый же перенос блока между уроками.
     «Версии этого урока» — фильтр по истории курса. */
  const lesson = (id: string, title: string, text: string) => ({
    id, slug: id, title, order: 1,
    blocks: [{ id: `${id}-b1`, type: "rich_text" as const, content: [{ kind: "p" as const, text }] }],
  });

  const courseWith = (first: ReturnType<typeof lesson>, second: ReturnType<typeof lesson>) => ({
    id: "c1", slug: "kurs", title: "Курс", programSlug: "kurs", brand: "centerway",
    locale: "uk", translationGroupId: "g1", status: "draft", version: 1,
    schedule: { mode: "open" }, entitlementProductCodes: [],
    modules: [{ id: "m1", slug: "m-1", title: "Модуль", order: 1, lessons: [first, { ...second, order: 2 }] }],
  });

  const revisionRow = (n: number, content: unknown) => ({
    id: `r${n}`, course_id: "c1", revision_number: n, kind: "autosave_checkpoint",
    content, content_hash: "0".repeat(64), label: null, created_by: null,
    parent_revision_id: null, source_revision_id: null,
    created_at: `2026-09-0${n}T00:00:00.000Z`,
  });

  beforeEach(async () => {
    const { adminClient } = await import("@/lib/auth/adminClient");
    const a1 = lesson("l1", "Урок 1", "Перший");
    const b1 = lesson("l2", "Урок 2", "Другий");

    const db = new FakeSupabase({
      lms_course_revisions: [
        revisionRow(1, courseWith(a1, b1)),
        // Змінився ТІЛЬКИ другий урок.
        revisionRow(2, courseWith(a1, lesson("l2", "Урок 2", "Другий, змінений"))),
        // Тепер змінився перший.
        revisionRow(3, courseWith(lesson("l1", "Урок 1", "Перший, змінений"), lesson("l2", "Урок 2", "Другий, змінений"))),
      ],
      platform_users: [],
    });
    vi.mocked(adminClient).mockImplementation(() => db as never);
  });

  it("оставляет только те записи, где менялся именно этот урок", async () => {
    const first = await listLessonRevisions("c1", "l1");
    expect(first.map((entry) => entry.revision.id)).toEqual(["r3"]);

    const second = await listLessonRevisions("c1", "l2");
    expect(second.map((entry) => entry.revision.id)).toEqual(["r2"]);
  });

  it("говорит, что именно случилось с уроком", async () => {
    const [entry] = await listLessonRevisions("c1", "l2");
    expect(entry.change).toMatchObject({ kind: "changed", lessonId: "l2", blocks: { edited: 1 } });
  });

  it("возвращает пустую историю для урока, которого не касались", async () => {
    expect(await listLessonRevisions("c1", "unknown")).toEqual([]);
  });
});
