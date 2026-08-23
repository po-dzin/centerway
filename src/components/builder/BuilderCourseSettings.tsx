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

import { useState } from "react";

import { Icon } from "@/components/Icon";
import {
  COURSE_TEMPLATES,
  COURSE_HEADING_FONTS,
  COURSE_PALETTES,
  COURSE_TYPE_SCALES,
  DEFAULT_COURSE_THEME,
  type Course,
  type CourseHeadingFont,
  type CourseScheduleGate,
  type CourseScheduleMode,
  type CourseTypeScale,
  type CourseVisibility,
  type CourseTemplateId,
} from "@/lms-core";
import { BuilderImageField } from "./BuilderImageField";
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

const VISIBILITY_LABELS: Record<CourseVisibility, string> = {
  hidden: "Ніхто",
  unlisted: "За посиланням",
  listed: "У каталозі",
};

/**
 * Visibility is NOT «опубліковано».
 *
 * `status` says whether the material is open to the people who already own the
 * course; this says whether strangers may find it. Two courses prove they are
 * independent: one sold through a landing is published and unlisted, one
 * finished but waiting on a price is published and hidden.
 */
const VISIBILITY_HINTS: Record<CourseVisibility, string> = {
  hidden: "Курс видно тільки тим, хто вже має до нього доступ. Це стан за замовчуванням.",
  unlisted: "У курсу є сторінка, на яку можна дати посилання, але в каталозі й пошуку його немає.",
  listed: "Курс стоїть у каталозі поряд з рештою.",
};

/**
 * The promises, as a list the author can grow.
 *
 * Separate from the field table because the table describes fields that exist
 * and cannot say "there should be a fourth one" — the same reason
 * `RepeatControls` exists in the lesson editor.
 */
function ResultsField({
  results,
  onChange,
}: {
  results: string[];
  onChange: (path: (string | number)[], value: unknown) => void;
}) {
  // Empty is ABSENT, as everywhere else: the validator rejects `[]` because a
  // heading over nothing is worse than no heading.
  const write = (next: string[]) => onChange(["results"], next.length > 0 ? next : undefined);

  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>Що людина отримає</span>
      {results.map((result, index) => (
        <div className={styles.itemRow} key={index}>
          <input
            className={styles.input}
            type="text"
            value={result}
            aria-label={`Результат ${index + 1}`}
            onChange={(event) => write(results.map((one, at) => (at === index ? event.target.value : one)))}
          />
          <button
            className={styles.iconAction}
            type="button"
            title="Прибрати"
            aria-label={`Прибрати результат ${index + 1}`}
            onClick={() => write(results.filter((_, at) => at !== index))}
          >
            <Icon name="close" size={18} />
          </button>
        </div>
      ))}
      <button className={styles.addAction} type="button" onClick={() => write([...results, ""])}>
        <span className={styles.addGlyph} aria-hidden="true">+</span> Ще один
      </button>
      <span className={styles.fieldHint}>
        Короткі твердження, не абзаци. Порожні рядки не зберігаються.
      </span>
    </div>
  );
}

export function BuilderCourseSettings({
  course,
  onChange,
  onApplyTemplate,
}: {
  course: Course;
  onChange: (path: (string | number)[], value: unknown) => void;
  onApplyTemplate: (template: CourseTemplateId) => void;
}) {
  const [pendingTemplate, setPendingTemplate] = useState<CourseTemplateId | null>(null);
  const theme = { ...DEFAULT_COURSE_THEME, ...(course.theme ?? {}) };
  const gate = course.schedule.gate ?? "soft";

  return (
    <div className={styles.settingsForm}>
      {/* Name and summary are NOT here any more. They are the heading and the
          lead of the course page itself, edited where they are read; a settings
          sheet holding a second copy of them is a second place for them to be
          wrong. What stays here is what has no place in the document: the
          address, the schedule, the entitlement codes, the palette. */}
      {/* The course page owns the address editor. Settings only explains the
          lifecycle boundary so the same value is not edited in two places. */}
      <p className={styles.readOnlyNote}>
        Адреса курсу: <code>my.centerway.net.ua/{course.slug}</code>. Її можна змінити у заголовку, поки курс лишається
        невикористаною прихованою чернеткою; після випуску або появи учнів адреса закріплюється. До каталогу курс додає
        адміністратор.
      </p>

      <h3 className={styles.subTitle}>Стартова структура</h3>
      <p className={styles.fieldHint}>Пресет замінює модулі й уроки, але не назву, опис, обкладинку чи доступ.</p>
      <div className={styles.typeGrid}>
        {COURSE_TEMPLATES.map((template) => (
          <button
            key={template.id}
            className={styles.typeOption}
            type="button"
            aria-pressed={pendingTemplate === template.id}
            onClick={() => setPendingTemplate(template.id)}
          >
            <span className={styles.typeName}>{template.title}</span>
            <span className={styles.typeHint}>{template.summary}</span>
          </button>
        ))}
      </div>
      {pendingTemplate ? (
        <div className={styles.confirmRow}>
          <span className={styles.confirmText}>Замінити поточну структуру? Дію можна скасувати через «Назад».</span>
          <button className={styles.quietAction} type="button" onClick={() => setPendingTemplate(null)}>Ні</button>
          <button
            className={styles.commitAction}
            type="button"
            onClick={() => {
              onApplyTemplate(pendingTemplate);
              setPendingTemplate(null);
            }}
          >
            Застосувати
          </button>
        </div>
      ) : null}

      {/* THE AUTHOR'S HALF OF THE STOREFRONT. What the course claims about
          itself is content, and content is the author's. The PRICE is not here
          and will not be: it is a commitment the business makes to a buyer, and
          it lives in `lms_course_offers`, which the builder's routes have no
          grant on. That is a different table rather than a hidden field
          precisely so the boundary is structural. */}
      <h3 className={styles.subTitle}>Вітрина</h3>
      <p className={styles.readOnlyNote}>
        Видимість: <strong>{VISIBILITY_LABELS[course.visibility ?? "hidden"]}</strong>. {VISIBILITY_HINTS[course.visibility ?? "hidden"]}{" "}
        Автор готує матеріал і сторінку; видимість у вітрині змінює лише адміністратор.
      </p>
      <FieldInput
        field={{
          path: ["tagline"],
          label: "Рядок під назвою",
          kind: "text",
          hint: "Не те саме, що опис. Опис каже, що це; цей рядок каже, навіщо це вам.",
        }}
        value={course.tagline}
        onChange={onChange}
      />
      <ResultsField results={course.results ?? []} onChange={onChange} />

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
      <BuilderImageField
        label="Зображення"
        hint="Шлях від кореня сайту (/cw/…), повне посилання, або файл із вашого комп'ютера."
        courseSlug={course.slug}
        src={course.cover?.src}
        alt={course.cover?.alt}
        onChange={(next) => onChange(["cover", "src"], next)}
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
