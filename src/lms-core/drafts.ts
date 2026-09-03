/**
 * CenterWay LMS core — what a NEW thing looks like.
 *
 * PURE TS. No DOM, no React, no Next, no npm deps.
 *
 * Adding a block, a lesson, a module or a course is the same act from three
 * places — the builder's "+", the import CLI, and (H3) the author's agent — so
 * the shape of a fresh one lives here rather than being invented by whichever
 * surface has the button.
 *
 * TWO RULES SHAPE EVERY FACTORY BELOW.
 *
 * 1. A new thing is STRUCTURALLY VALID immediately. `validateCourse` runs on
 *    every save, and a "+" that produced a course the validator rejects would
 *    mean the author cannot save until they have finished filling in a form
 *    they cannot see the whole of — every empty required field becomes a wall
 *    between them and their own unsaved work.
 *
 * 2. A new thing is NOT PUBLISHABLE. Every hole carries `[ЗАПОВНИ: …]`, so the
 *    readiness gate names it, the course page counts it, and the editor rings
 *    the field. That is the repo's standing rule about health content — a hole
 *    may be left, it may not be invented — applied to the one place that
 *    creates holes on purpose.
 *
 * Ids are passed in, not generated. The core has no crypto and no clock; the
 * caller has both, and a caller that wants deterministic ids for a test or a
 * fixture gets them for free.
 */

import type { LessonBlock, LessonBlockType, RichTextNode } from "./blocks";
import type { Course, CourseModule, Lesson } from "./course";
import { inlineToPlainText, type InlineText } from "./inline";
import { PLACEHOLDER_MARKER } from "./readiness";

/** A source of fresh ids — `crypto.randomUUID` in both browser and Node. */
export type IdSource = () => string;

/** The hole marker, closed. `PLACEHOLDER_MARKER` is the opening half only. */
export function todo(what: string): string {
  return `${PLACEHOLDER_MARKER}: ${what}]`;
}

/**
 * A URL-safe key from a title, transliterated.
 *
 * Cyrillic has to be transliterated rather than stripped: a title written in
 * Ukrainian would otherwise slugify to the empty string, and every lesson in a
 * course would collide on the same fallback. The table is deliberately plain
 * ASCII output — a slug is an address, and addresses get typed, mailed and
 * pasted into places that mangle anything else.
 */
const TRANSLITERATION: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "h", ґ: "g", д: "d", е: "e", є: "ie", ж: "zh",
  з: "z", и: "y", і: "i", ї: "i", й: "i", к: "k", л: "l", м: "m", н: "n",
  о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts",
  ч: "ch", ш: "sh", щ: "shch", ь: "", ю: "iu", я: "ia", ы: "y", э: "e", ъ: "",
  ё: "e",
};

export function slugify(title: string): string {
  const base = [...title.toLowerCase()]
    .map((char) => TRANSLITERATION[char] ?? char)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base.length > 0 ? base : "item";
}

/**
 * The name a course is born with, before its author has given it one.
 *
 * Lives here, beside `slugify`, because it is the INPUT that produces the
 * default address: the builder titles a new draft «Новий курс», «Новий курс 2»,
 * … and derives the slug from that title. Two modules therefore have to agree
 * on this string — the one that hands out the name and the one that refuses to
 * publish it — and a second copy of it would drift the first time the wording
 * changed.
 */
export const DEFAULT_DRAFT_TITLE = "Новий курс";

/**
 * Is this address still the one the builder invented?
 *
 * A slug is not a name, it is a PERMANENT address: it goes into the sitemap,
 * into `course:<slug>` on every order, and into the link a buyer is sent. It is
 * also the one field an author never has to look at — the title is in front of
 * them and the slug is not — so the failure is silent and one-directional. A
 * real course reached the storefront titled «Soul Daily Ritual» and addressed
 * `/programs/novyi-kurs-5`, in the sitemap, indexable, with the slug already
 * written into fourteen orders.
 *
 * Matches both ways the default can be numbered: the title counter
 * («Новий курс 5» → `novyi-kurs-5`) and `uniqueSlug`'s collision suffix, which
 * produce the same shape and are equally unmeant.
 */
export function isDefaultDraftSlug(slug: string): boolean {
  const base = slugify(DEFAULT_DRAFT_TITLE);
  return new RegExp(`^${base}(?:-\\d+)?$`).test(slug.trim().toLowerCase());
}

/** `slugify`, then a numeric suffix until it stops colliding. */
export function uniqueSlug(title: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const base = slugify(title);
  if (!used.has(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!used.has(candidate)) return candidate;
  }
}

/**
 * A fresh block of the given type.
 *
 * Every branch is exhaustive over `LessonBlockType`, so a twelfth block type
 * fails to compile here until someone says what a new one of it looks like —
 * which is the point. A type the builder can list but not create is a button
 * that throws.
 */
export function newBlock(type: LessonBlockType, ids: IdSource): LessonBlock {
  const id = ids();
  switch (type) {
    case "group":
      return { id, type, children: [newBlock("rich_text", ids)] };
    case "lesson_objective":
      return { id, type, text: todo("для чого цей урок") };
    case "rich_text":
      return { id, type, content: [{ kind: "p", text: todo("текст") }] };
    case "protocol_step":
      return { id, type, step: 1, title: todo("назва кроку") };
    case "practice_block":
      return { id, type, title: todo("назва практики") };
    case "checklist":
      return { id, type, items: [{ id: ids(), text: todo("пункт") }] };
    // A plausible-looking id would be worse than a marked hole: the readiness
    // gate accepts anything shaped like a YouTube id, so a decoy would publish.
    case "video":
      return { id, type, provider: "youtube", videoId: todo("ID відео") };
    case "image":
      return { id, type, src: todo("шлях до файлу"), alt: todo("опис зображення") };
    case "quote":
      return { id, type, text: todo("цитата") };
    case "code":
      return { id, type, code: todo("код") };
    case "boundary_note":
      return { id, type, text: todo("межі та застереження") };
    case "faq_block":
      return { id, type, items: [{ id: ids(), question: todo("питання"), answer: todo("відповідь") }] };
    case "table":
      return {
        id,
        type,
        head: [todo("колонка 1"), todo("колонка 2")],
        rows: [[todo("клітинка"), todo("клітинка")]],
      };
    case "cta":
      return { id, type, label: todo("напис"), href: todo("посилання") };
  }
}

/** A fresh row for a table, sized to the table it joins. */
export function newTableRow(columns: number): string[] {
  return Array.from({ length: Math.max(1, columns) }, () => todo("клітинка"));
}

export function newLesson(ids: IdSource, options: { order: number; dayIndex?: number; title?: string; slug?: string }): Lesson {
  const title = options.title ?? todo("назва уроку");
  return {
    id: ids(),
    slug: options.slug ?? `lesson-${options.order}`,
    title,
    order: options.order,
    ...(options.dayIndex === undefined ? {} : { dayIndex: options.dayIndex }),
    // A lesson with no blocks fails `validateCourse`, so one is not a nicety.
    // The objective is the right one to be born with: it is the block that says
    // what the lesson is for, and a lesson whose author never answered that is
    // the lesson that turns into a wall of text.
    blocks: [newBlock("lesson_objective", ids)],
  };
}

export function newModule(ids: IdSource, options: { order: number; title?: string; slug?: string; dayIndex?: number }): CourseModule {
  return {
    id: ids(),
    slug: options.slug ?? `module-${options.order}`,
    title: options.title ?? todo("назва модуля"),
    order: options.order,
    lessons: [newLesson(ids, { order: 1, dayIndex: options.dayIndex })],
  };
}

export function newCourse(
  ids: IdSource,
  options: { slug: string; title: string; programSlug: string; brand?: string; locale?: Course["locale"] }
): Course {
  return {
    id: ids(),
    slug: options.slug,
    title: options.title,
    programSlug: options.programSlug,
    brand: options.brand ?? "centerway",
    locale: options.locale ?? "uk",
    // Its own group until a translation joins it: a shared constant here would
    // silently make every new course a translation of every other one.
    translationGroupId: ids(),
    status: "draft",
    version: 1,
    schedule: { mode: "open" },
    entitlementProductCodes: [],
    modules: [newModule(ids, { order: 1, title: "Модуль 1", slug: "module-1" })],
  };
}

/**
 * Moves one item and returns a new array. Out-of-range targets clamp rather
 * than throw — "up" on the first row is a no-op an author expects, not an error.
 */
/**
 * Drops the prose an author started and did not write.
 *
 * WHY THIS HAS TO EXIST. `validateInlineText` refuses an empty string, and it
 * is right to: an empty paragraph in a published lesson is a gap a learner
 * sees. But an editor where Enter opens the next paragraph produces empty
 * paragraphs constantly — that is what Enter IS — and the alternative, seeding
 * each new node with a `[ЗАПОВНИ: …]` marker the author has to select and
 * delete before typing, is the rigidity this editor exists to remove.
 *
 * So the rule is the one every document editor uses: an empty paragraph is not
 * content, and it does not survive the save. This runs on the way OUT, over the
 * payload only — never over the editor's own state, which would delete the
 * paragraph out from under the caret that is sitting in it.
 *
 * A block emptied of every node is dropped too. A lesson emptied of every block
 * is NOT: that is a claim about the lesson, and `validateCourse` should be the
 * one to refuse it, by name, in the readiness list.
 */
export function pruneEmptyProse(course: Course): Course {
  const written = (text: InlineText | undefined) =>
    text !== undefined && inlineToPlainText(text).trim().length > 0;
  const prune = (blocks: LessonBlock[]): LessonBlock[] => blocks.flatMap<LessonBlock>((block) => {
    if (block.type === "group") {
      const children = prune(block.children);
      return children.length ? [{ ...block, children }] : [];
    }
    if (block.type !== "rich_text") return [block];
    const content = block.content.flatMap<RichTextNode>((node) => {
      if (node.kind === "ul" || node.kind === "ol") {
        const items = node.items.filter(written);
        return items.length ? [{ ...node, items }] : [];
      }
      return written(node.text) ? [node] : [];
    });
    return content.length ? [{ ...block, content }] : [];
  });

  return {
    ...course,
    modules: course.modules.map((module) => ({
      ...module,
      lessons: module.lessons.map((lesson) => ({
        ...lesson,
        blocks: prune(lesson.blocks),
      })),
    })),
  };
}

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length) return items;
  const target = Math.min(Math.max(to, 0), items.length - 1);
  if (target === from) return items;
  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved);
  return next;
}

/**
 * Rewrites every `order` to match array position.
 *
 * Called after every structural edit rather than maintained incrementally. The
 * `order` column is what the database sorts by, and an array whose positions
 * and stored orders disagree is a course that reads back in a different
 * sequence than the author just arranged — the one bug reordering must not have.
 */
export function renumber(modules: CourseModule[]): CourseModule[] {
  return modules.map((module, moduleIndex) => ({
    ...module,
    order: moduleIndex + 1,
    lessons: module.lessons.map((lesson, lessonIndex) => ({ ...lesson, order: lessonIndex + 1 })),
  }));
}

/**
 * Re-walks `step` over the protocol steps of one lesson.
 *
 * Same class of number as `order` and `dayIndex`, and it was the one that got
 * missed: `step` is a POSITION in the day's protocol, and it was a field the
 * author typed. Insert a step in the middle and every number below it is wrong
 * — silently, because the badge renders whatever the field says and nothing
 * validates that 1,2,2,4 is not a sequence.
 *
 * Blocks that are not protocol steps are passed through untouched, so a step
 * separated from the next one by a paragraph still counts as the step after it.
 */
export function renumberSteps(blocks: LessonBlock[]): LessonBlock[] {
  let step = 0;
  const renumber = (items: LessonBlock[]): LessonBlock[] => items.map((block) => {
    if (block.type === "group") return { ...block, children: renumber(block.children) };
    if (block.type !== "protocol_step") return block;
    step += 1;
    return block.step === step ? block : { ...block, step };
  });
  return renumber(blocks);
}

/**
 * The day number a NEW lesson should take in a `daily` course.
 *
 * One past the highest that exists — never a renumber of what is already there.
 *
 * An earlier pass had a `renumberDays` that rewrote every stepping lesson to a
 * contiguous 1..N, and it was wrong about what a day number is. In `way21` the
 * lessons run 1, 2, 3, 4, 7 — a twenty-one-day programme has twenty-one days
 * and fewer lessons than that, and day 7 means the seventh DAY, not the seventh
 * lesson. Renumbering would have compressed the gaps out and moved every
 * reminder already scheduled against them, on one press of a reorder arrow.
 *
 * So `dayIndex` is authored, like the title. What derivation is still good for
 * is the one case where leaving it blank is a wall: a lesson added to a daily
 * course with no day at all fails `validateCourse` on save.
 */
export function nextDayIndex(course: Course): number | undefined {
  if (course.schedule.mode !== "daily") return undefined;
  const used = course.modules
    .filter((entry) => !entry.reference)
    .flatMap((entry) => entry.lessons.map((lesson) => lesson.dayIndex ?? 0));
  return Math.max(0, ...used) + 1;
}
