"use client";

/**
 * The tool rail's panel content for a lesson: contents, history, versions.
 *
 * Split out of BuilderLessonEditor.tsx (1,871 lines, seven components) on 2026-09-10.
 */

import { Icon } from "@/components/Icon";
import type { Course, Lesson, LessonBlock, LessonBlockType } from "@/lms-core";
import { FieldInput } from "./BuilderFields";
import { InkLabel } from "./BuilderInkLabel";
import type { BuilderToolMode } from "./BuilderToolRail";
import { BLOCK_TYPE_HINTS, BLOCK_TYPE_LABELS, BLOCK_TYPE_ORDER, BLOCK_STRUCTURE_ORDER, BLOCK_TEMPLATE_ORDER } from "./blockFields";
import styles from "./Builder.module.css";
import { RepeatControls } from "./LessonBlockEditor";
import { BUILDER_BLOCK_MIME, carryChip } from "./lessonDragMime";

export function LessonToolContent({
  mode,
  course,
  lesson,
  selectedBlock,
  selectedBlockIndex,
  search,
  insertPosition,
  working,
  importPicker,
  onSearch,
  onInsert,
  onLessonChange,
  onBlockChange,
  onImport,
}: {
  mode: BuilderToolMode;
  course: Course;
  lesson: Lesson;
  selectedBlock: LessonBlock | null;
  selectedBlockIndex: number;
  search: string;
  insertPosition: number;
  working: boolean;
  importPicker: { current: HTMLInputElement | null };
  onSearch: (value: string) => void;
  onInsert: (position: number, type: LessonBlockType) => void;
  onLessonChange: (path: (string | number)[], value: unknown) => void;
  onBlockChange: (path: (string | number)[], value: unknown) => void;
  onImport: (file: File) => Promise<void>;
}) {
  if (mode === "blocks") {
    const query = search.trim().toLocaleLowerCase("uk");
    const visibleTypes = BLOCK_TYPE_ORDER.filter((type) =>
      `${BLOCK_TYPE_LABELS[type]} ${BLOCK_TYPE_HINTS[type]}`.toLocaleLowerCase("uk").includes(query)
    );
    const groups = [
      { title: "Текст і медіа", types: visibleTypes.filter((type) => type === "rich_text" || BLOCK_STRUCTURE_ORDER.includes(type)) },
      { title: "Практика і навчання", types: visibleTypes.filter((type) => BLOCK_TEMPLATE_ORDER.includes(type)) },
    ];

    return (
      <div className={styles.toolStack}>
        <label className={styles.toolSearch}>
          <Icon name="view-rows" size={18} />
          <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Знайти блок…" />
        </label>
        <p className={styles.toolHint}>Додасться в обрану позицію {insertPosition + 1}. Перетягніть блок на знак + або натисніть його.</p>
        {groups.map((group) => group.types.length > 0 ? (
          <section className={styles.toolGroup} key={group.title}>
            <h3>{group.title}</h3>
            <div className={styles.toolLibrary}>
              {group.types.map((type) => (
                <button
                  className={styles.toolBlock}
                  type="button"
                  key={type}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "copy";
                    event.dataTransfer.setData(BUILDER_BLOCK_MIME, type);
                    carryChip(event, BLOCK_TYPE_LABELS[type]);
                  }}
                  onClick={() => onInsert(insertPosition, type)}
                >
                  <Icon name={type === "practice_block" ? "motion" : type === "boundary_note" ? "boundary" : "document"} size={20} />
                  <span><InkLabel strong>{BLOCK_TYPE_LABELS[type]}</InkLabel><small>{BLOCK_TYPE_HINTS[type]}</small></span>
                  <Icon name="grip" size={16} />
                </button>
              ))}
            </div>
          </section>
        ) : null)}
        {visibleTypes.length === 0 ? <p className={styles.toolEmpty}>Нічого не знайдено. Спробуйте коротшу назву.</p> : null}
      </div>
    );
  }

  if (mode === "block") {
    if (!selectedBlock || selectedBlockIndex < 0) {
      return <p className={styles.toolEmpty}>Оберіть блок у документі — тут з’являться його властивості.</p>;
    }
    /* PROPERTIES, NOT CONTENT. What a block SAYS is edited at the block, in the
       document; what is left here is what the block IS — where it sits, what it
       is called in the data, and how often it comes back. A panel that also
       held the words meant the author read the table on one side of the screen
       and typed it on the other. */
    return (
      <div className={styles.toolStack}>
        <div className={styles.toolSelectionTitle}>
          <Icon name="boundary" size={20} />
          <span><small>Блок {selectedBlockIndex + 1}</small><strong>{BLOCK_TYPE_LABELS[selectedBlock.type]}</strong></span>
        </div>
        <p className={styles.toolHint}>{BLOCK_TYPE_HINTS[selectedBlock.type]}</p>
        <RepeatControls block={selectedBlock} onChange={onBlockChange} />
        <p className={styles.toolHint}>
          {selectedBlock.type === "rich_text"
            ? "Текст редагується просто на сторінці."
            : "Вміст блоку редагується під ним у документі — оберіть блок."}
        </p>
      </div>
    );
  }

  if (mode === "page") {
    return (
      <div className={styles.toolStack}>
        {/* IT SAYS REPLACE, BECAUSE IT REPLACES. There are two document imports
            in the builder now and they do opposite things: the structure's adds
            new lessons to a module, this one overwrites the open one. Both
            labelled «Імпортувати» they would read as the same offer in two
            places, and the destructive one is the one an author would reach for
            by mistake. See the lifecycle note for why this level can only ever
            mean replace: by the time you are on the page, the lesson exists. */}
        <button className={styles.quietAction} type="button" disabled={working} onClick={() => importPicker.current?.click()}>
          <Icon name="import" size={20} /> Замінити з документа
        </button>
        <p className={styles.toolHint}>
          Замінить назву, опис і всі блоки цього уроку. Адреса, порядок і день лишаються. Скасовується через ⌘Z до збереження.
        </p>
        <input
          ref={importPicker}
          className={styles.visuallyHidden}
          type="file"
          accept=".md,.markdown,.docx,.txt,text/markdown,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void onImport(file);
          }}
        />
        <FieldInput
          field={{
            path: ["dayIndex"],
            label: "День курсу",
            kind: "number",
            hint: course.schedule.mode === "daily" ? "День програми; пропуски можуть бути навмисними." : "Використовується лише в курсах з розкладом по днях.",
          }}
          value={lesson.dayIndex}
          onChange={onLessonChange}
        />
        <FieldInput field={{ path: ["durationMin"], label: "Тривалість, хв", kind: "number" }} value={lesson.durationMin} onChange={onLessonChange} />
        <p className={styles.readOnlyNote}>Адреса: <code>/learn/{course.slug}/{lesson.slug}</code><br />Закріплена для посилань і нагадувань.</p>
      </div>
    );
  }

  return null;
}
