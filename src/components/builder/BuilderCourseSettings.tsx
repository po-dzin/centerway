"use client";

/**
 * Everything about a course that is not its lessons.
 *
 * Split out of the course page because the two are different jobs done at
 * different times: structure is edited constantly while writing, settings once
 * at the start and then almost never. Folded shut by default for the same
 * reason — an author opening a course to fix a paragraph should not have to
 * scroll past the entitlement codes to reach the lesson list.
 */

import {
  COURSE_HEADING_FONTS,
  COURSE_PALETTES,
  COURSE_TYPE_SCALES,
  DEFAULT_COURSE_THEME,
  type Course,
  type CourseHeadingFont,
  type CourseScheduleGate,
  type CourseScheduleMode,
  type CourseTypeScale,
} from "@/lms-core";
import { ChoiceRow, FieldInput } from "./BuilderFields";
import { PALETTE_LABELS } from "./coursePalettes";
import styles from "./Builder.module.css";

const FONT_LABELS: Record<CourseHeadingFont, string> = {
  editorial: "Серіф",
  ui: "Гротеск",
};

const SCALE_LABELS: Record<CourseTypeScale, string> = {
  compact: "Щільно",
  regular: "Звично",
  generous: "Просторо",
};

const MODE_LABELS: Record<CourseScheduleMode, string> = {
  open: "Вільно",
  sequential: "Послідовно",
  daily: "По днях",
};

const MODE_HINTS: Record<CourseScheduleMode, string> = {
  open: "Ритму немає — довідковий матеріал, який відкривають, коли треба.",
  sequential: "Наступний урок іде за попереднім.",
  daily: "Урок N належить дню N від старту, у часовому поясі учня.",
};

const GATE_LABELS: Record<CourseScheduleGate, string> = {
  soft: "День — підказка",
  hard: "День — замок",
};

export function BuilderCourseSettings({
  course,
  onChange,
}: {
  course: Course;
  onChange: (path: (string | number)[], value: unknown) => void;
}) {
  const theme = { ...DEFAULT_COURSE_THEME, ...(course.theme ?? {}) };
  const gate = course.schedule.gate ?? "soft";

  return (
    <div className={styles.settingsForm}>
      <FieldInput field={{ path: ["title"], label: "Назва", kind: "text" }} value={course.title} onChange={onChange} />
      <FieldInput
        field={{ path: ["summary"], label: "Короткий опис", kind: "inline", multiline: true }}
        value={course.summary}
        onChange={onChange}
      />

      {/* The course slug is the address of every lesson under it and of every
          reminder already sent. Shown, never edited — a rename is a migration. */}
      <p className={styles.readOnlyNote}>
        Адреса курсу: <code>/learn/{course.slug}</code> — не змінюється. Програма в каталозі:{" "}
        <code>{course.programSlug}</code>.
      </p>

      <h3 className={styles.subTitle}>Ритм</h3>
      <ChoiceRow
        label="Розклад"
        hint={MODE_HINTS[course.schedule.mode]}
        options={(Object.keys(MODE_LABELS) as CourseScheduleMode[]).map((mode) => ({
          value: mode,
          label: MODE_LABELS[mode],
        }))}
        value={course.schedule.mode}
        onChange={(next) => onChange(["schedule", "mode"], next)}
      />

      {course.schedule.mode === "daily" ? (
        <>
          <ChoiceRow
            label="Що робить день із тим, хто біжить попереду"
            hint={
              gate === "soft"
                ? "Завтрашній урок відкривається сьогодні. Чесний варіант для протоколу, який купили."
                : "Урок закритий до свого дня. Тільки для матеріалу, який поза чергою небезпечний."
            }
            options={(Object.keys(GATE_LABELS) as CourseScheduleGate[]).map((value) => ({
              value,
              label: GATE_LABELS[value],
            }))}
            value={gate}
            onChange={(next) => onChange(["schedule", "gate"], next)}
          />
          <FieldInput
            field={{
              path: ["schedule", "reminderHour"],
              label: "Година нагадування",
              kind: "number",
              hint: "0–23, у часовому поясі учня. Порожньо — нагадувань за днями немає.",
            }}
            value={course.schedule.reminderHour}
            onChange={onChange}
          />
        </>
      ) : null}

      <h3 className={styles.subTitle}>Вигляд</h3>
      <ChoiceRow
        label="Гама"
        hint="Готові гами платформи. Кожну вже перевірено на контраст — власних кольорів тут немає навмисно."
        options={COURSE_PALETTES.map((palette) => ({
          value: palette,
          label: PALETTE_LABELS[palette],
          swatch: palette === "default" ? undefined : palette,
        }))}
        value={theme.palette}
        onChange={(next) => onChange(["theme", "palette"], next)}
      />
      <ChoiceRow
        label="Заголовки"
        hint="Серіф — для тексту, який читають. Гротеск — для протоколу, який виконують."
        options={COURSE_HEADING_FONTS.map((font) => ({ value: font, label: FONT_LABELS[font] }))}
        value={theme.headingFont}
        onChange={(next) => onChange(["theme", "headingFont"], next)}
      />
      <ChoiceRow
        label="Щільність"
        options={COURSE_TYPE_SCALES.map((scale) => ({ value: scale, label: SCALE_LABELS[scale] }))}
        value={theme.scale}
        onChange={(next) => onChange(["theme", "scale"], next)}
      />

      <h3 className={styles.subTitle}>Обкладинка</h3>
      <FieldInput
        field={{
          path: ["cover", "src"],
          label: "Зображення",
          kind: "text",
          hint: "Шлях від кореня сайту (/cw/…) або повне посилання https://…",
        }}
        value={course.cover?.src}
        onChange={onChange}
      />
      <FieldInput
        field={{
          path: ["cover", "alt"],
          label: "Опис для тих, хто не бачить зображення",
          kind: "text",
          multiline: true,
        }}
        value={course.cover?.alt}
        onChange={onChange}
      />
      {course.cover?.src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className={styles.previewImage} src={course.cover.src} alt={course.cover.alt ?? ""} />
      ) : null}

      <h3 className={styles.subTitle}>Доступ</h3>
      <FieldInput
        field={{
          path: [],
          label: "Коди продуктів, що відкривають курс",
          kind: "text",
          hint: "Через кому. Порожньо — курс не відкривається жодною покупкою.",
        }}
        value={course.entitlementProductCodes.join(", ")}
        // Written back as an array, not as the string the author typed: the
        // contract is a list of codes, and storing the raw line would put the
        // separator inside the data.
        onChange={(_path, value) =>
          onChange(
            ["entitlementProductCodes"],
            typeof value === "string"
              ? value.split(",").map((code) => code.trim()).filter(Boolean)
              : []
          )
        }
      />
    </div>
  );
}
