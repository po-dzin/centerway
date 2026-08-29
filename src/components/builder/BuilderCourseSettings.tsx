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
import { plural } from "@/lib/plural";
import {
  COURSE_CATEGORIES,
  COURSE_DURATION_DAYS_MAX,
  COURSE_HEADING_FONTS,
  COURSE_KINDS,
  COURSE_PALETTES,
  COURSE_POSTTITLE_MAX,
  COURSE_PRETITLE_MAX,
  COURSE_TYPE_SCALES,
  DEFAULT_COURSE_THEME,
  type Course,
  type CourseCategory,
  type CourseHeadingFont,
  type CourseKind,
  type CourseScheduleGate,
  type CourseScheduleMode,
  type CourseTypeScale,
  type CourseVisibility,
} from "@/lms-core";
import { BuilderCoverEditor } from "./BuilderCoverEditor";
import { ChoiceRow, ChoiceSet, FieldInput } from "./BuilderFields";
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

/**
 * WHAT KIND OF THING THIS IS. Called «Формат» to the author, because that is
 * the word they use — and note that `course.format` already exists meaning
 * something else entirely (the MEDIUM: «6 відео + чек-лист»). That older field
 * is relabelled «З чого складається» on the page tab so the two never sit on
 * one screen both called «Формат»; one author putting «чекліст» into the wrong
 * one is a bug nobody would find, because both values look plausible.
 */
const KIND_LABELS: Record<CourseKind, string> = {
  course: "Курс",
  mini: "Міні-курс",
  checklist: "Чек-лист",
};

const CATEGORY_LABELS: Record<CourseCategory, string> = {
  movement: "Рух",
  nutrition: "Харчування",
  cleansing: "Очищення",
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

type SettingsSectionId = "cover" | "titles" | "badge" | "rhythm" | "appearance" | "storefront";

/**
 * Which tab a settings block belongs to.
 *
 * TWO TABS, TWO QUESTIONS. «Обкладинка» is the CARD — everything a stranger
 * scrolling a catalogue sees before they have decided to care: the picture, the
 * three lines around the title, the badge. «Сторінка» is the OFFER — everything
 * they read after they clicked, when they are deciding whether to buy.
 *
 * Splitting them is not tidying. They are filled at different times by
 * different intents, and they fail differently: a bad card is never clicked, a
 * bad page is clicked and abandoned. One long form made the second half of the
 * work look optional because it was below the fold of the first.
 */
export type SettingsScope = "cover" | "page";

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
  scope,
  onChange,
}: {
  course: Course;
  scope: SettingsScope;
  onChange: (path: (string | number)[], value: unknown) => void;
}) {
  const [editing, setEditing] = useState<SettingsSectionId | null>(null);
  const theme = { ...DEFAULT_COURSE_THEME, ...(course.theme ?? {}) };
  const gate = course.schedule.gate ?? "soft";
  const visibility = course.visibility ?? "hidden";
  const categories = course.categories ?? [];
  // Every lesson, reference material included — the same count the catalogue
  // card prints. `countLessons` answers a different question (steps a learner
  // walks) and would quietly disagree with the shelf.
  const lessonCount = course.modules.reduce((total, module) => total + module.lessons.length, 0);

  /* THE STAR MEANS THE GATE, and this is where the two are tied together.
     `courseReadiness` refuses to publish a VISIBLE course without these; a
     hidden one it lets through, because a course nobody can find owes a
     stranger nothing. So the star follows visibility rather than being painted
     on for good — an author working on a hidden draft is not nagged about a
     catalogue they have not entered yet. */
  const showcase = visibility !== "hidden" ? (true as const) : undefined;

  if (scope === "page") {
    return (
      <div className={styles.settingsForm}>
      {/* THE AUTHOR'S HALF OF THE STOREFRONT. What the course claims about
          itself is content, and content is the author's. The PRICE is not here
          and will not be: it is a commitment the business makes to a buyer, and
          it lives in `lms_course_offers`, which the builder's routes have no
          grant on. That is a different table rather than a hidden field
          precisely so the boundary is structural. */}
      <SettingsSection
        id="storefront"
        title="Сторінка програми"
        editing={editing === "storefront"}
        onEdit={setEditing}
        summary={
          <>
            <strong>{VISIBILITY_LABELS[visibility]}</strong>
            {/* Counts rather than contents: the fold has to say whether the offer
                page has anything to print without reprinting it. */}
            <span>
              {[
                `${course.results?.length ?? 0} результатів`,
                `${course.audience?.length ?? 0} для кого`,
                `${course.format?.length ?? 0} у складі`,
              ].join(" · ")}
            </span>
          </>
        }
      >
        <p className={styles.readOnlyNote}>
          Видимість: <strong>{VISIBILITY_LABELS[visibility]}</strong>. {VISIBILITY_HINTS[visibility]} Автор готує матеріал і сторінку; видимість змінює адміністратор.
        </p>
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
        {/* RENAMED, NOT MOVED. The key is still `format` and the data is
            untouched; the LABEL changed because «Формат» now names the closed
            list on the cover tab (курс / міні-курс / чек-лист). Two controls
            called «Формат» on one product is how an author puts «чекліст» into
            the wrong one — and both values look right afterwards, so nobody
            finds it. This one always meant the MEDIUM, and its own hint already
            read that way. */}
        <StringListField
          path="format"
          label="З чого складається"
          itemLabel="Складова"
          hint="Носій, не структура: відео, аудіо, чек-листи, рецепти. Рід курсу — на вкладці «Обкладинка»."
          items={course.format ?? []}
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
        {/* `authorNote` moved to its own tab (2026-08-28) — see
            `BuilderCourseAuthor.tsx`. It sits beside the byline it modifies
            rather than beside the rest of the storefront copy, now that the
            byline has a tab of its own to sit in. */}
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

  /* ─────────────────────────────────────────────────────────────────────────
     THE COVER TAB — everything a catalogue card is made of.

     Name, short description and address are NOT here: they are edited in the
     page heading a few rows above this panel, where they are also READ. Moving
     them into a fold would have made the course's own title a setting. */
  return (
    <div className={styles.settingsForm}>
      <SettingsSection
        id="cover"
        title="Обкладинка"
        editing={editing === "cover"}
        onEdit={setEditing}
        summary={
          course.cover?.src
            ? <><strong>{course.cover.alt || "Опис зображення не додано"}</strong><span>Горизонтальний кадр · mobile автокроп</span></>
            : <span>Зображення ще не додано</span>
        }
      >
        <BuilderCoverEditor course={course} onChange={onChange} />
        {/* ALT IS REQUIRED WHENEVER THE IMAGE IS. `validateCourse` refuses a
            cover with no alt outright — not at publish, at SAVE — so this star
            is not the showcase gate and does not follow visibility like the
            others. A picture on a page a stranger reaches with nothing for a
            screen reader to say is an accessibility failure, and this repo
            gates on those. */}
        <FieldInput
          field={{
            path: ["cover", "alt"],
            label: "Опис зображення",
            kind: "text",
            multiline: true,
            required: course.cover?.src ? true : undefined,
            hint: "Що на фото — одним реченням, для тих, хто його не бачить. Без «зображення» на початку.",
          }}
          value={course.cover?.alt}
          onChange={onChange}
        />
      </SettingsSection>

      <SettingsSection
        id="titles"
        title="Заголовок"
        editing={editing === "titles"}
        onEdit={setEditing}
        summary={
          <>
            <strong>{course.tagline || "Рядок під назвою не додано"}</strong>
            <span>
              {[course.pretitle, course.posttitle].filter(Boolean).join(" · ") ||
                "Надзаголовок і підзаголовок не додані"}
            </span>
          </>
        }
      >
        {/* THREE LINES AROUND ONE NAME, and the name itself is not among them:
            it is edited at the top of this page, where it is displayed. Putting
            a second title field here would have given the course two names and
            no rule about which one wins. */}
        <FieldInput
          field={{
            path: ["pretitle"],
            label: "Надзаголовок",
            kind: "text",
            maxLength: COURSE_PRETITLE_MAX,
            hint: `Маленький рядок НАД назвою: «Авторський курс», «Спільно з IREM». До ${COURSE_PRETITLE_MAX} символів. Рід і тривалість тут не потрібні — їх друкує бейдж.`,
          }}
          value={course.pretitle}
          onChange={onChange}
        />
        <FieldInput
          field={{
            path: ["posttitle"],
            label: "Підзаголовок",
            kind: "text",
            maxLength: COURSE_POSTTITLE_MAX,
            hint: `Рядок ПІД назвою — що це за річ: «практикум з умовного голодування». До ${COURSE_POSTTITLE_MAX} символів.`,
          }}
          value={course.posttitle}
          onChange={onChange}
        />
        <FieldInput
          field={{
            path: ["tagline"],
            label: "Рядок під назвою",
            kind: "text",
            required: showcase,
            hint: "Навіщо цей курс людині — одне речення. Це те, що читають на картці замість опису.",
          }}
          value={course.tagline}
          onChange={onChange}
        />
      </SettingsSection>

      <SettingsSection
        id="badge"
        title="Бейдж"
        editing={editing === "badge"}
        onEdit={setEditing}
        summary={
          <>
            <strong>{course.kind ? KIND_LABELS[course.kind] : "Рід не вказано"}</strong>
            <span>
              {[
                course.durationDays !== undefined
                  ? `${course.durationDays} ${plural(course.durationDays, "день", "дні", "днів")}`
                  : null,
                `${lessonCount} ${plural(lessonCount, "урок", "уроки", "уроків")}`,
                categories.length > 0
                  ? categories.map((one) => CATEGORY_LABELS[one]).join(", ")
                  : "розділ не вказано",
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </>
        }
      >
        {/* THE COUNT IS NOT A FIELD. It is read off the structure, it is always
            true, and an author who could type it would be able to make it
            false. It is shown here because it is part of the badge they are
            editing — as a fact, in the place the other two facts are set. */}
        <p className={styles.readOnlyNote}>
          Уроків: <strong>{lessonCount}</strong>. Рахується зі змісту курсу — окремого поля немає.
        </p>
        <ChoiceRow
          label="Формат"
          clearable
          hint="Що це за річ. Стоїть у лівому верхньому куті картки. Не вказано — каталог рахує уроки й вирішує сам."
          options={COURSE_KINDS.map((value) => ({ value, label: KIND_LABELS[value] }))}
          value={course.kind}
          onChange={(next) => onChange(["kind"], next)}
        />
        <ChoiceSet
          label="Розділ"
          required={showcase}
          hint="Про що курс. Можна кілька. Закритий список — за ним каталог фільтрує полицю."
          options={COURSE_CATEGORIES.map((value) => ({ value, label: CATEGORY_LABELS[value] }))}
          values={categories}
          onChange={(next) => onChange(["categories"], next)}
        />
        {/* A NUMBER, NOT «3 дні». The badge writes the word, in the locale it is
            being read in; the author writes the number once. This is the field
            that used to be prose, and the prose could not be compared, filtered
            or translated. */}
        <FieldInput
          field={{
            path: ["durationDays"],
            label: "Тривалість, днів",
            kind: "number",
            required: showcase,
            min: 1,
            max: COURSE_DURATION_DAYS_MAX,
            hint: "Скільки днів курс займає в людини. Число — «дні/днів» допише сама вітрина. Порожньо — покажемо кількість уроків.",
          }}
          value={course.durationDays}
          onChange={onChange}
        />
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
          onChange={(next) => next && onChange(["theme", "palette"], next)}
        />
        <ChoiceRow
          label="Заголовки"
          options={COURSE_HEADING_FONTS.map((font) => ({ value: font, label: FONT_LABELS[font] }))}
          value={theme.headingFont}
          onChange={(next) => next && onChange(["theme", "headingFont"], next)}
        />
        <ChoiceRow
          label="Щільність"
          options={COURSE_TYPE_SCALES.map((scale) => ({ value: scale, label: SCALE_LABELS[scale] }))}
          value={theme.scale}
          onChange={(next) => next && onChange(["theme", "scale"], next)}
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
          onChange={(next) => next && onChange(["schedule", "mode"], next)}
        />
        {course.schedule.mode === "daily" ? (
          <>
            <ChoiceRow
              label="Доступ до наступного дня"
              hint={gate === "soft" ? "Наступний урок доступний раніше свого дня." : "Урок закритий до свого дня."}
              options={(Object.keys(GATE_LABELS) as CourseScheduleGate[]).map((value) => ({ value, label: GATE_LABELS[value] }))}
              value={gate}
              onChange={(next) => next && onChange(["schedule", "gate"], next)}
            />
            <FieldInput
              field={{ path: ["schedule", "reminderHour"], label: "Година нагадування", kind: "number", min: 0, max: 23, hint: "0–23 у часовому поясі учня." }}
              value={course.schedule.reminderHour}
              onChange={onChange}
            />
          </>
        ) : null}
      </SettingsSection>
    </div>
  );
}
