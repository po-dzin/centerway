/**
 * A refused save, in the author's words.
 *
 * `saveCourse` returns the server's `detail`, which is the assertion identifier
 * `lms-core/course.ts` threw — `lms_course_cover_missing_alt:builder` and its
 * kin. That string was being written straight into the save bar, where the
 * author reads it as "something broke" rather than as "you left a field
 * empty": it names a rule in a language nobody on this side of the screen
 * speaks, and it does not say what to do about it.
 *
 * It is the same shape as `lessonDocumentCopy`, and deliberately so — one way
 * of turning a refusal into a sentence, not two.
 *
 * SHORT, BECAUSE OF WHERE IT LANDS. This reads out in the save bar's status
 * line, between the undo pair and the save button — a strip a few words wide
 * that already truncates «Зміни збережуться автоматично». A full instruction
 * put there arrives as «Додайте опис обкладинки — коротке речення про те, що
 * на зобра…», which is an instruction the author cannot finish reading.
 *
 * So each line is a NAMED REFUSAL, not a how-to: what is missing and where,
 * short enough to survive the strip. The how-to belongs beside the field that
 * is missing it, which is a separate job — the save bar's one duty is to say
 * that the save did not go through and why.
 *
 * THE PATH SUFFIX IS DROPPED. Codes arrive as `code:path` where the path is the
 * validator's own breadcrumb (`builder`, `modules.0.lessons.2`). It locates the
 * failure for us, not for the author, and on a course-level field it is always
 * the same word.
 *
 * Anything unmapped keeps the fallback rather than the code. A message an
 * author cannot act on is worth less than one that at least says the save did
 * not go through — and if a new rule starts firing here, the fallback is what
 * makes it show up as a complaint instead of as noise nobody reports.
 */
const MESSAGES: Record<string, string> = {
  lms_course_cover_missing_alt: "Не збережено: в обкладинки немає опису.",
  lms_course_cover_missing_src: "Не збережено: обкладинка втратила файл.",
  lms_course_invalid_cover: "Не збережено: обкладинку не вдалося прочитати.",
  lms_course_invalid_cover_crop: "Не збережено: кадрування обкладинки поза межами.",
  lms_course_invalid_cover_mobile_src: "Не збережено: вертикальне фото втратило файл.",
  lms_course_missing_title: "Не збережено: у курсу немає назви.",
  lms_course_missing_slug: "Не збережено: у курсу немає адреси.",
  lms_course_empty_modules: "Не збережено: потрібен хоча б один урок.",
  lms_course_missing_start_date: "Не збережено: розклад по днях без дати старту.",
  lms_course_invalid_schedule_mode: "Не збережено: некоректний режим розкладу.",
  lms_course_invalid_reminder_hour: "Не збережено: година нагадувань поза межами.",
  lms_course_invalid_tagline: "Не збережено: рядок під назвою задовгий.",
};

export function courseSaveFailureCopy(detail: string | undefined, fallback: string): string {
  if (!detail) return fallback;
  return MESSAGES[detail.split(":")[0]] ?? fallback;
}
