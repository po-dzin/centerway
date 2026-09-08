import { describe, expect, it } from "vitest";

import type { Course } from "./course";
import { diffCourses } from "./diff";

function course(modules: Course["modules"], overrides: Partial<Course> = {}): Course {
  return {
    id: "c1",
    slug: "kurs",
    title: "Курс",
    programSlug: "kurs",
    brand: "centerway",
    locale: "uk",
    translationGroupId: "g1",
    status: "draft",
    version: 1,
    schedule: { mode: "open" },
    entitlementProductCodes: [],
    modules,
    ...overrides,
  } as Course;
}

const boundary = (id: string, text: string) => ({ id, type: "boundary_note" as const, text });
const prose = (id: string, text: string) => ({ id, type: "rich_text" as const, content: [{ kind: "p" as const, text }] });

const base = () => course([
  {
    id: "m1", slug: "m-1", title: "Модуль 1", order: 1,
    lessons: [
      { id: "l1", slug: "l-1", title: "Урок 1", order: 1, blocks: [prose("b1", "Текст"), boundary("b2", "Не для вагітних")] },
      { id: "l2", slug: "l-2", title: "Урок 2", order: 2, blocks: [prose("b3", "Другий")] },
    ],
  },
]);

describe("diffCourses", () => {
  it("не находит разницы там, где её нет, включая иной порядок ключей", () => {
    const left = base();
    const right = JSON.parse(JSON.stringify(base())) as Course;
    expect(diffCourses(left, right).empty).toBe(true);
  });

  /* Счётчик двигается на каждом сохранении. Если бы он считался изменением,
     список правок никогда не был бы пустым и перестал бы что-либо значить. */
  it("не считает изменением счётчик version", () => {
    const after = { ...base(), version: 99 };
    expect(diffCourses(base(), after).empty).toBe(true);
  });

  /* Та самая правка, ради обнаружения которой журнал и заводили: курс прошёл
     проверку, после чего у него переписали блок «межі». */
  it("поднимает флаг, когда переписан блок «межі»", () => {
    const after = course([{
      ...base().modules[0],
      lessons: [
        { ...base().modules[0].lessons[0], blocks: [prose("b1", "Текст"), boundary("b2", "Підходить усім")] },
        base().modules[0].lessons[1],
      ],
    }]);

    const diff = diffCourses(base(), after);
    expect(diff.boundaryTouched).toBe(true);
    expect(diff.lessons).toHaveLength(1);
    expect(diff.lessons[0]).toMatchObject({ kind: "changed", lessonId: "l1", boundaryTouched: true });
    expect(diff.lessons[0]).toMatchObject({ blocks: { added: 0, removed: 0, edited: 1 } });
  });

  it("замечает удаление блока «межі», а не только правку", () => {
    const after = course([{
      ...base().modules[0],
      lessons: [
        { ...base().modules[0].lessons[0], blocks: [prose("b1", "Текст")] },
        base().modules[0].lessons[1],
      ],
    }]);
    const diff = diffCourses(base(), after);
    expect(diff.boundaryTouched).toBe(true);
    expect(diff.lessons[0]).toMatchObject({ blocks: { added: 0, removed: 1, edited: 0 } });
  });

  /* Сравнение по id, а не по позиции: иначе один сдвиг на курсе из двадцати
     уроков выглядел бы как двадцать правок и прятал бы настоящую. */
  it("видит перемещение как перемещение, а не как удаление и добавление", () => {
    const [first, second] = base().modules[0].lessons;
    const after = course([{
      ...base().modules[0],
      lessons: [{ ...second, order: 1 }, { ...first, order: 2 }],
    }]);

    const diff = diffCourses(base(), after);
    expect(diff.lessons.every((entry) => entry.kind === "changed")).toBe(true);
    expect(diff.lessons.map((entry) => entry.lessonId).sort()).toEqual(["l1", "l2"]);
    for (const entry of diff.lessons) {
      expect(entry).toMatchObject({ moved: true, blocks: { added: 0, removed: 0, edited: 0 } });
    }
    expect(diff.boundaryTouched).toBe(false);
  });

  it("различает добавленный и удалённый урок и называет их модуль", () => {
    const after = course([{
      ...base().modules[0],
      lessons: [
        base().modules[0].lessons[0],
        { id: "l3", slug: "l-3", title: "Новий урок", order: 2, blocks: [prose("b9", "Нове")] },
      ],
    }]);

    const diff = diffCourses(base(), after);
    expect(diff.lessons).toContainEqual({ kind: "added", lessonId: "l3", title: "Новий урок", moduleTitle: "Модуль 1" });
    expect(diff.lessons).toContainEqual({ kind: "removed", lessonId: "l2", title: "Урок 2", moduleTitle: "Модуль 1" });
  });

  it("перечисляет изменённые поля курса", () => {
    const diff = diffCourses(base(), { ...base(), title: "Інша назва", tagline: "Слоган" } as Course);
    expect(diff.fields).toContain("title");
    expect(diff.fields).toContain("tagline");
    expect(diff.lessons).toHaveLength(0);
  });

  it("находит правку внутри группы блоков", () => {
    const grouped = (text: string) => course([{
      ...base().modules[0],
      lessons: [
        { ...base().modules[0].lessons[0], blocks: [{ id: "g1", type: "group" as const, children: [boundary("b2", text)] }] },
        base().modules[0].lessons[1],
      ],
    }]);

    const diff = diffCourses(grouped("Обережно"), grouped("Без обмежень"));
    expect(diff.boundaryTouched).toBe(true);
  });
});
