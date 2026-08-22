/**
 * CenterWay LMS core — ready-made course skeletons.
 *
 * PURE TS. No DOM, no React, no Next, no npm deps.
 *
 * A new course used to be one module with one lesson, which is the right
 * default for nothing. The two courses the house actually ships have a SHAPE —
 * a «перед стартом» module, a numbered body, a reference module at the end —
 * and every author writing a third one would have rebuilt that shape by hand,
 * differently, and then discovered the difference at publish time.
 *
 * THREE RULES, and the third is the one that is easy to get wrong.
 *
 * 1. A template produces a course that VALIDATES. Same rule as `drafts.ts`: an
 *    author must never meet a wall between them and their own unsaved work.
 * 2. Every hole carries `[ЗАПОВНИ: …]`, so the readiness gate names it. A
 *    template fills in STRUCTURE, never content — it may not invent a sentence
 *    about someone's body.
 * 3. **A daily template must carry a boundary block.** `courseReadiness` adds
 *    `lms_ready_missing_boundary` to any course that is `daily` or body-facing
 *    and has no `boundary_note` anywhere. Without one, a course born from a
 *    template would open with a blocker that is not a hole the author left —
 *    it is one the template forgot, and it reads as the tool being broken.
 */

import type { Course, CourseModule, CourseSchedule } from "./course";
import { newBlock, newLesson, todo, uniqueSlug, type IdSource } from "./drafts";

export type CourseTemplateId = "blank" | "practicum" | "program" | "handbook";

export type CourseTemplate = {
  id: CourseTemplateId;
  title: string;
  /** One line: when to reach for this one rather than the next. */
  summary: string;
  schedule: CourseSchedule;
  build: (ids: IdSource) => CourseModule[];
};

/** A lesson with a named set of blocks, all of them marked unfilled. */
function lesson(
  ids: IdSource,
  options: { title: string; slug: string; order: number; blocks: Array<Parameters<typeof newBlock>[0]> }
) {
  const base = newLesson(ids, { order: options.order, title: options.title, slug: options.slug });
  return { ...base, blocks: options.blocks.map((type) => newBlock(type, ids)) };
}

function module(
  ids: IdSource,
  options: { title: string; slug: string; order: number; reference?: boolean; lessons: ReturnType<typeof lesson>[] }
): CourseModule {
  return {
    id: ids(),
    slug: options.slug,
    title: options.title,
    order: options.order,
    ...(options.reference ? { reference: true } : {}),
    lessons: options.lessons,
  };
}

export const COURSE_TEMPLATES: CourseTemplate[] = [
  {
    id: "blank",
    title: "Порожній",
    summary: "Один модуль, один урок. Коли форма курсу ще не вирішена.",
    schedule: { mode: "open" },
    build: (ids) => [
      module(ids, {
        title: "Модуль 1",
        slug: "module-1",
        order: 1,
        lessons: [lesson(ids, { title: "Урок 1", slug: "lesson-1", order: 1, blocks: ["lesson_objective"] })],
      }),
    ],
  },
  {
    id: "practicum",
    title: "Практикум на 3 дні",
    summary: "Підготовка → сам день → вихід, плюс довідка. Форма розвантажувального дня.",
    schedule: { mode: "daily", gate: "soft", start: "purchase", reminderHour: 8 },
    build: (ids) => [
      module(ids, {
        title: "Перед стартом",
        slug: "before-start",
        order: 1,
        lessons: [
          // The boundary block lives on the first lesson, where a reader meets
          // it before doing anything — and it is what keeps a daily course from
          // being born with `lms_ready_missing_boundary` already against it.
          lesson(ids, {
            title: "Технічна інформація",
            slug: "intro",
            order: 1,
            blocks: ["lesson_objective", "rich_text", "boundary_note"],
          }),
          lesson(ids, {
            title: "Розпорядок дня",
            slug: "schedule",
            order: 2,
            blocks: ["lesson_objective", "table"],
          }),
        ],
      }),
      module(ids, {
        title: "Три етапи",
        slug: "route",
        order: 2,
        lessons: [
          lesson(ids, {
            title: "Етап 1. Підготовка",
            slug: "day-1",
            order: 1,
            blocks: ["lesson_objective", "protocol_step", "protocol_step", "checklist"],
          }),
          lesson(ids, {
            title: "Етап 2. Основний день",
            slug: "day-2",
            order: 2,
            blocks: ["lesson_objective", "protocol_step", "protocol_step", "practice_block", "checklist"],
          }),
          lesson(ids, {
            title: "Етап 3. Вихід",
            slug: "day-3",
            order: 3,
            blocks: ["lesson_objective", "protocol_step", "checklist"],
          }),
        ],
      }),
      module(ids, {
        title: "Довідкові матеріали",
        slug: "materials",
        order: 3,
        reference: true,
        lessons: [lesson(ids, { title: "Довідка", slug: "reference", order: 1, blocks: ["rich_text", "faq_block"] })],
      }),
    ],
  },
  {
    id: "program",
    title: "Програма на 21 день",
    summary: "Три тижні по сім днів, підготовка й матеріали. Форма «Шляху 21».",
    schedule: { mode: "daily", gate: "soft", start: "purchase", reminderHour: 8 },
    build: (ids) => {
      // Days 1..21, and the intro IS day 1 — the same shape way21 has. An
      // earlier draft put the intro on day 1 and then started the weeks at
      // day 2, so a lesson titled «День 5» carried dayIndex 6 and the badge
      // beside it disagreed with its own name.
      const weeks = [1, 2, 3].map((week) => {
        const first = (week - 1) * 7 + (week === 1 ? 2 : 1);
        const last = week * 7;
        return module(ids, {
          title: `Тиждень ${week}`,
          slug: `week-${week}`,
          order: week + 1,
          lessons: Array.from({ length: last - first + 1 }, (_, index) => {
            const day = first + index;
            return lesson(ids, {
              title: `День ${day}`,
              slug: `day-${day}`,
              order: index + 1,
              blocks: ["lesson_objective", "protocol_step", "checklist"],
            });
          }),
        });
      });

      return [
        module(ids, {
          title: "Перед стартом",
          slug: "before-start",
          order: 1,
          lessons: [
            lesson(ids, {
              title: "День 1. Технічна інформація",
              slug: "intro",
              order: 1,
              blocks: ["lesson_objective", "rich_text", "boundary_note"],
            }),
          ],
        }),
        ...weeks,
        module(ids, {
          title: "Довідкові матеріали",
          slug: "materials",
          order: 5,
          reference: true,
          lessons: [lesson(ids, { title: "Довідка", slug: "reference", order: 1, blocks: ["rich_text", "faq_block"] })],
        }),
      ];
    },
  },
  {
    id: "handbook",
    title: "Довідник",
    summary: "Матеріал, який відкривають, коли треба. Без днів і без послідовності.",
    schedule: { mode: "open" },
    build: (ids) => [
      // One stepping module even in a handbook: a course whose every module is
      // reference has zero steps, so the learner's progress is "0 of 0" and the
      // course can never be finished. One page that says how to use it fixes
      // that and is a page a handbook wants anyway.
      module(ids, {
        title: "Як користуватися",
        slug: "how-to",
        order: 1,
        lessons: [lesson(ids, { title: "Як користуватися", slug: "how-to", order: 1, blocks: ["lesson_objective", "rich_text"] })],
      }),
      module(ids, {
        title: "Довідник",
        slug: "reference",
        order: 2,
        reference: true,
        lessons: [
          lesson(ids, { title: "Розділ 1", slug: "section-1", order: 1, blocks: ["rich_text", "table"] }),
          lesson(ids, { title: "Розділ 2", slug: "section-2", order: 2, blocks: ["rich_text", "faq_block"] }),
        ],
      }),
    ],
  },
];

export function findTemplate(id: string | undefined): CourseTemplate {
  return COURSE_TEMPLATES.find((template) => template.id === id) ?? COURSE_TEMPLATES[0];
}

/**
 * A course built from a template.
 *
 * `dayIndex` is assigned here rather than written into each template: a fresh
 * daily course starts with its stepping lessons on days 1..N, and a template
 * that hard-coded the numbers would go stale the moment one of its lessons
 * moved. This is a STARTING point, not a rule — once the course exists the day
 * numbers are the author's, gaps included (see `nextDayIndex` in drafts.ts).
 */
export function newCourseFromTemplate(
  ids: IdSource,
  options: {
    slug: string;
    title: string;
    programSlug: string;
    template?: string;
    theme?: Course["theme"];
    brand?: string;
    locale?: Course["locale"];
  }
): Course {
  const template = findTemplate(options.template);
  const modules = template.build(ids);

  // Lesson slugs are unique across the WHOLE course, so a template that reused
  // one — «reference» in two modules, say — would fail validation on creation.
  const taken = new Set<string>();
  let day = 0;
  const numbered = modules.map((entry) => ({
    ...entry,
    lessons: entry.lessons.map((item) => {
      const slug = taken.has(item.slug) ? uniqueSlug(item.slug, taken) : item.slug;
      taken.add(slug);
      if (template.schedule.mode !== "daily" || entry.reference) return { ...item, slug };
      day += 1;
      return { ...item, slug, dayIndex: day };
    }),
  }));

  return {
    id: ids(),
    slug: options.slug,
    title: options.title,
    programSlug: options.programSlug,
    brand: options.brand ?? "centerway",
    locale: options.locale ?? "uk",
    // Its own group until a translation joins it.
    translationGroupId: ids(),
    status: "draft",
    version: 1,
    schedule: template.schedule,
    entitlementProductCodes: [],
    ...(options.theme ? { theme: options.theme } : {}),
    summary: todo("про що цей курс"),
    modules: numbered,
  };
}
