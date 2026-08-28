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

import { useState, type ReactNode } from "react";

import { Icon } from "@/components/Icon";
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
  type CourseVisibility,
} from "@/lms-core";
import { BuilderCoverEditor } from "./BuilderCoverEditor";
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
 * A list the author can grow — promises, audiences, formats.
 *
 * Separate from the field table because the table describes fields that exist
 * and cannot say "there should be a fourth one" — the same reason
 * `RepeatControls` exists in the lesson editor.
 *
 * Was `ResultsField`, hard-wired to `results`, until the offer page needed the
 * same control for «для кого» and «формат». Three copies of a row of inputs
 * with a remove button is how a builder stops looking like one thing.
 */
function StringListField({
  path,
  label,
  itemLabel,
  hint,
  items,
  onChange,
}: {
  path: string;
  label: string;
  /** Singular, for the screen-reader label on each row: "Результат 2". */
  itemLabel: string;
  hint: string;
  items: string[];
  onChange: (path: (string | number)[], value: unknown) => void;
}) {
  // Empty is ABSENT, as everywhere else: the validator rejects `[]` because a
  // heading over nothing is worse than no heading.
  const write = (next: string[]) => onChange([path], next.length > 0 ? next : undefined);

  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      {items.map((item, index) => (
        <div className={styles.itemRow} key={index}>
          <input
            className={styles.input}
            type="text"
            value={item}
            aria-label={`${itemLabel} ${index + 1}`}
            onChange={(event) => write(items.map((one, at) => (at === index ? event.target.value : one)))}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
          />
          <button
            className={styles.iconAction}
            type="button"
            title="Прибрати"
            aria-label={`Прибрати: ${itemLabel} ${index + 1}`}
            onClick={() => write(items.filter((_, at) => at !== index))}
          >
            <Icon name="close" size={18} />
          </button>
        </div>
      ))}
      <button className={styles.addAction} type="button" onClick={() => write([...items, ""])}>
        <span className={styles.addGlyph} aria-hidden="true">+</span> Ще один
      </button>
      <span className={styles.fieldHint}>{hint}</span>
    </div>
  );
}

type SettingsSectionId = "storefront" | "rhythm" | "appearance" | "cover";

/**
 * A setting reads as part of the course until the author explicitly reaches
 * for it. The pencil is deliberately the only permanent control: keeping the
 * form open all the time made rare configuration look as important as the
 * course's title and promise.
 */
function SettingsSection({
  id,
  title,
  summary,
  editing,
  onEdit,
  children,
}: {
  id: SettingsSectionId;
  title: string;
  summary: ReactNode;
  editing: boolean;
  onEdit: (id: SettingsSectionId | null) => void;
  children: ReactNode;
}) {
  return (
    <section className={styles.courseSettingSection} aria-labelledby={`course-setting-${id}`}>
      <div className={styles.courseSettingHead}>
        <div className={styles.courseSettingCopy}>
          <h3 className={styles.courseSettingTitle} id={`course-setting-${id}`}>{title}</h3>
          {!editing ? <div className={styles.courseSettingSummary}>{summary}</div> : null}
        </div>
        <button
          className={styles.courseSettingEdit}
          type="button"
          aria-label={editing ? `Закрити налаштування «${title}»` : `Редагувати «${title}»`}
          title={editing ? "Готово" : "Редагувати"}
          aria-expanded={editing}
          onClick={() => onEdit(editing ? null : id)}
        >
          <Icon name={editing ? "close" : "edit"} size={16} />
        </button>
      </div>
      {editing ? <div className={styles.courseSettingEditor}>{children}</div> : null}
    </section>
  );
}

export function BuilderCourseSettings({
  course,
  onChange,
}: {
  course: Course;
  onChange: (path: (string | number)[], value: unknown) => void;
}) {
  const [editing, setEditing] = useState<SettingsSectionId | null>(null);
  const theme = { ...DEFAULT_COURSE_THEME, ...(course.theme ?? {}) };
  const gate = course.schedule.gate ?? "soft";
  const visibility = course.visibility ?? "hidden";

  return (
    <div className={styles.settingsForm}>
      {/* Name, summary and address live in the course heading, where they are
          read. Repeating the address here made the automatic/locked state look
          like a second setting rather than one route boundary. */}

      {/* THE AUTHOR'S HALF OF THE STOREFRONT. What the course claims about
          itself is content, and content is the author's. The PRICE is not here
          and will not be: it is a commitment the business makes to a buyer, and
          it lives in `lms_course_offers`, which the builder's routes have no
          grant on. That is a different table rather than a hidden field
          precisely so the boundary is structural. */}
      <SettingsSection
        id="storefront"
        title="Вітрина"
        editing={editing === "storefront"}
        onEdit={setEditing}
        summary={
          <>
            <strong>{course.tagline || "Рядок під назвою не додано"}</strong>
            {/* Counts rather than contents: the fold has to say whether the offer
                page has anything to print without reprinting it. */}
            <span>
              {[
                VISIBILITY_LABELS[visibility],
                course.duration,
                `${course.results?.length ?? 0} результатів`,
                `${course.audience?.length ?? 0} для кого`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </>
        }
      >
        <p className={styles.readOnlyNote}>
          Видимість: <strong>{VISIBILITY_LABELS[visibility]}</strong>. {VISIBILITY_HINTS[visibility]} Автор готує матеріал і сторінку; видимість змінює адміністратор.
        </p>
        <FieldInput
          field={{ path: ["tagline"], label: "Рядок під назвою", kind: "text", hint: "Коротко: навіщо цей курс людині." }}
          value={course.tagline}
          onChange={onChange}
        />
        <StringListField
          path="results"
          label="Що людина отримає"
          itemLabel="Результат"
          hint="Короткі твердження, не абзаци. Порожні рядки не зберігаються."
          items={course.results ?? []}
          onChange={onChange}
        />
        <StringListField
          path="audience"
          label="Для кого"
          itemLabel="Аудиторія"
          hint="Друга половина обіцянки: «що зміниться» вже сказано вище, тут — з ким."
          items={course.audience ?? []}
          onChange={onChange}
        />
        <StringListField
          path="format"
          label="Формат та інструменти"
          itemLabel="Формат"
          hint="З чого курс складається: відео, аудіо, чек-листи, рецепти. Не структура — саме носій."
          items={course.format ?? []}
          onChange={onChange}
        />
        {/* WHY DURATION IS TYPED AND NOT COUNTED. The offer page derives «12
            уроків» from the structure, which is true and answers a question
            nobody asked. A course whose lessons are meant to be walked over
            three days says «3 дні», and no lesson count can know that. Left
            empty, the derived count stays — this field only overrides it. */}
        <FieldInput
          field={{ path: ["duration"], label: "Тривалість", kind: "text", hint: "Словами автора: «3 дні», «21 день». Порожньо — рахуємо уроки." }}
          value={course.duration}
          onChange={onChange}
        />
        {/* Prose, not policy. What actually cuts access off is the expiry on the
            grant itself, set when the seat is sold; this is the promise printed
            beside the price. They are free to differ on purpose — «доступ
            назавжди» is still compatible with revoking a refunded seat. */}
        <FieldInput
          field={{ path: ["accessNote"], label: "Термін доступу", kind: "text", hint: "Що обіцяємо покупцю: «доступ назавжди», «30 днів після покупки»." }}
          value={course.accessNote}
          onChange={onChange}
        />
        <FieldInput
          field={{ path: ["authorNote"], label: "Чому саме ви — про цей курс", kind: "text", multiline: true, hint: "Одне речення. Біографія і фото живуть у профілі автора, тут — тільки те, що змінюється від курсу до курсу." }}
          value={course.authorNote}
          onChange={onChange}
        />
      </SettingsSection>

      <SettingsSection
        id="rhythm"
        title="Ритм"
        editing={editing === "rhythm"}
        onEdit={setEditing}
        summary={<><strong>{MODE_LABELS[course.schedule.mode]}</strong><span>{MODE_HINTS[course.schedule.mode]}</span></>}
      >
        <ChoiceRow
          label="Розклад"
          hint={MODE_HINTS[course.schedule.mode]}
          options={(Object.keys(MODE_LABELS) as CourseScheduleMode[]).map((mode) => ({ value: mode, label: MODE_LABELS[mode] }))}
          value={course.schedule.mode}
          onChange={(next) => onChange(["schedule", "mode"], next)}
        />
        {course.schedule.mode === "daily" ? (
          <>
            <ChoiceRow
              label="Доступ до наступного дня"
              hint={gate === "soft" ? "Наступний урок доступний раніше свого дня." : "Урок закритий до свого дня."}
              options={(Object.keys(GATE_LABELS) as CourseScheduleGate[]).map((value) => ({ value, label: GATE_LABELS[value] }))}
              value={gate}
              onChange={(next) => onChange(["schedule", "gate"], next)}
            />
            <FieldInput
              field={{ path: ["schedule", "reminderHour"], label: "Година нагадування", kind: "number", hint: "0–23 у часовому поясі учня." }}
              value={course.schedule.reminderHour}
              onChange={onChange}
            />
          </>
        ) : null}
      </SettingsSection>

      <SettingsSection
        id="appearance"
        title="Вигляд"
        editing={editing === "appearance"}
        onEdit={setEditing}
        summary={<><strong>{PALETTE_LABELS[theme.palette]}</strong><span>{FONT_LABELS[theme.headingFont]} · {SCALE_LABELS[theme.scale]}</span></>}
      >
        <ChoiceRow
          label="Гама"
          options={COURSE_PALETTES.map((palette) => ({ value: palette, label: PALETTE_LABELS[palette], swatch: palette === "default" ? undefined : palette }))}
          value={theme.palette}
          onChange={(next) => onChange(["theme", "palette"], next)}
        />
        <ChoiceRow
          label="Заголовки"
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
      </SettingsSection>

      <SettingsSection
        id="cover"
        title="Обкладинка"
        editing={editing === "cover"}
        onEdit={setEditing}
        summary={course.cover?.src ? <><strong>{course.cover.alt || "Обкладинку додано"}</strong><span>Горизонтальний кадр · mobile автокроп</span></> : <span>Зображення ще не додано</span>}
      >
        <BuilderCoverEditor course={course} onChange={onChange} />
        <FieldInput
          field={{ path: ["cover", "alt"], label: "Опис зображення", kind: "text", multiline: true }}
          value={course.cover?.alt}
          onChange={onChange}
        />
      </SettingsSection>

      <details className={styles.courseSettingsAdvanced}>
        {/* THE GLYPH IS FROM THE SPRITE, like every other icon in this shell.
            It used to be a typed "+" and "−" in CSS `content` — the plus of the
            UI font at 1.1rem beside a set of baked hand-drawn icons, which is
            the one mark on this screen that came from somewhere else. The
            chevron also says the true thing: this opens, it does not add. */}
        <summary>
          Додатково
          <Icon className={styles.courseSettingsAdvancedGlyph} name="chevron-down" size={18} />
        </summary>
        {/* NO «Стартова структура» HERE ANY MORE. It moved to «Зміст», beside
            the modules and lessons it writes — see `BuilderStructureStart`. It
            was the one control able to rewrite the whole structure, and it sat
            on a different tab, folded away from everything it acts on. */}
        <div className={styles.courseSettingsAdvancedBody}>
          <FieldInput
            field={{ path: [], label: "Коди продуктів, що відкривають курс", kind: "text", hint: "Технічне поле. Коди вказуються через кому." }}
            value={course.entitlementProductCodes.join(", ")}
            onChange={(_path, value) => onChange(["entitlementProductCodes"], typeof value === "string" ? value.split(",").map((code) => code.trim()).filter(Boolean) : [])}
          />
        </div>
      </details>
    </div>
  );
}
