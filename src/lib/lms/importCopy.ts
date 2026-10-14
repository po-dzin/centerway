import type { Course, ReadinessBlocker } from "@/lms-core";

/** Keep machine codes in the API; show the author a one-based editorial address. */
export function importLocation(path: string): string {
  const labels: Record<string, string> = {
    modules: "Модуль",
    lessons: "урок",
    blocks: "блок",
    children: "вкладений блок",
    items: "пункт",
    rows: "рядок",
    content: "абзац",
  };
  const parts = Array.from(
    path.matchAll(/(modules|lessons|blocks|children|items|rows|content)\[(\d+)\]/g),
    (match) => `${labels[match[1]!]} ${Number(match[2]) + 1}`,
  );
  return parts.join(", ") || "Курс";
}

const LABELS: Record<string, string> = {
  lms_block_empty_content: "Додайте текст блоку.",
  lms_course_missing_title: "Додайте назву курсу.",
  lms_course_missing_slug: "Додайте назву курсу (title): з неї складемо адресу.",
  lms_course_title_too_long: "Скоротіть назву курсу: назва до 48 символів, разом із підзаголовком до 120.",
  lms_course_empty_modules: "Додайте масив modules з хоча б одним модулем, як у зразку JSON.",
  lms_lesson_missing_day_index: "Вкажіть dayIndex: у щоденному курсі кожен урок має свій день.",
  lms_block_unsupported_video_provider: 'Відео поки лише з YouTube: provider "youtube" і videoId.',
  lms_module_empty_lessons: "Додайте хоча б один урок.",
  lms_lesson_empty_blocks: "Додайте хоча б один блок.",
  lms_block_missing_text: "Додайте текст блоку.",
  lms_block_unknown_type: "Перевірте тип блоку за зразком JSON.",
  lms_block_missing_video_id: "Додайте ID відео YouTube.",
  lms_block_ragged_table: "Кожен рядок таблиці має містити однакову кількість клітинок.",
  lms_lesson_duplicate_slug: "Адреси уроків мають бути різними в межах курсу.",
  lms_builder_draft_conflict: "Курс змінився після перевірки. Виберіть файл ще раз перед оновленням.",
};

export function importIssueCopy(error: string): string {
  const [code = "", path = ""] = error.split(":");
  const label =
    LABELS[code] ??
    (code.includes("missing_title")
      ? "Додайте назву."
      : code.includes("missing")
        ? "Заповніть обов’язкове поле."
        : code.includes("empty")
          ? "Заповніть порожній елемент."
          : "Перевірте значення та структуру JSON за зразком.");
  // The location already names a course-level problem; a path with nothing
  // after its stage prefix used to print as «Поле: .».
  const field = path.replace(/^portable(?:\.(?:draft|update))?\.?/, "");
  return `${importLocation(path)}: ${label}${field ? ` Поле: ${field}.` : ""}`;
}

const BLOCKERS: Record<string, string> = {
  lms_ready_placeholder: "Заповніть позначений фрагмент",
  lms_ready_invalid_href: "Перевірте посилання",
  lms_ready_invalid_video_id: "Перевірте ID відео YouTube",
  lms_ready_invalid_image_src: "Додайте посилання на зображення",
  lms_ready_missing_boundary: "Додайте блок меж і застережень",
};

export function importBlockerCopy(course: Course, blocker: ReadinessBlocker): string {
  let location = "Курс";
  course.modules.forEach((module, mi) =>
    module.lessons.forEach((lesson, li) => {
      const prefix = `${course.slug}.${module.slug}.${lesson.slug}`;
      if (blocker.path === prefix || blocker.path.startsWith(`${prefix}.`)) {
        const block = /\.blocks\[(\d+)\]/.exec(blocker.path);
        location = `Модуль ${mi + 1}, урок ${li + 1} «${lesson.title}»${block ? `, блок ${Number(block[1]) + 1}` : ""}`;
      }
    }),
  );
  return `${location}: ${BLOCKERS[blocker.code] ?? "Доповніть матеріал перед публікацією"}${blocker.detail ? ` — ${blocker.detail}` : ""}`;
}
