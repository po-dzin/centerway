"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Icon } from "@/components/Icon";
import {
  courseThemeAttributes,
  flattenLessons,
  inlineToPlainText,
  moveItem,
  newBlock,
  newTableRow,
  renumberSteps,
  todo,
  type Course,
  type Lesson,
  type LessonBlock,
  type LessonBlockType,
  type RichTextNode,
} from "@/lms-core";
import { BuilderFailureNotice, BuilderNotice, BuilderShell, BuilderStep } from "./BuilderShell";
import { BuilderContents } from "./BuilderContents";
import { BuilderMenu } from "./BuilderMenu";
import { FieldInput } from "./BuilderFields";
import { BlockPreview } from "./BuilderBlockPreview";
import { loadCourse, saveCourse, type BuilderFailure } from "./builderClient";
import {
  BLOCK_TYPE_HINTS,
  BLOCK_TYPE_LABELS,
  BLOCK_TYPE_ORDER,
  describeBlock,
  readPath,
  writePath,
} from "./blockFields";
import styles from "./Builder.module.css";

type State =
  | { status: "loading" }
  | { status: "failed"; failure: BuilderFailure; detail?: string }
  | { status: "ready"; course: Course };

const ids = () => crypto.randomUUID();

/**
 * The editor — the part of the builder an author actually spends time in.
 *
 * WHOLE-COURSE STATE, ONE LESSON ON SCREEN. The save contract is a complete
 * course (see the API route), so the editor holds the whole thing and edits one
 * lesson inside it. That is not a compromise: it is what makes "save" a single
 * atomic write that either validates as a course or does not happen — no state
 * where a lesson saved and the course it belongs to did not. It is also what
 * lets the previous/next arrows and the contents drawer exist at all: the whole
 * sequence is already here, so navigation costs no request.
 *
 * TEXT IS MARKUP, NOT PLAIN. Inline values round-trip through the dialect in
 * lib/lms/inlineMarkup.ts, which is covered by a test over every inline value in
 * both shipped courses. Flattening to plain text would have deleted emphasis
 * and links from two thirds of the real content on first save.
 */
export function BuilderLessonEditor({ slug, lessonSlug }: { slug: string; lessonSlug: string }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: "loading" });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [contentsOpen, setContentsOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    // Guarded, and awaiting before the first setState: a synchronous setState in
    // an effect cascades a render for a state the component already starts in.
    let cancelled = false;
    void (async () => {
      const result = await loadCourse(slug);
      if (cancelled) return;
      setState(
        result.ok
          ? { status: "ready", course: result.data.course }
          : { status: "failed", failure: result.failure, detail: result.detail }
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Plain derivation, not memoized: it is two array scans over a handful of
  // modules, and the shape the compiler could not memoize anyway.
  const located = state.status === "ready" ? locateLesson(state.course, lessonSlug) : null;

  /** Applies a change to one path inside the current lesson. */
  const editLesson = useCallback(
    (path: (string | number)[], value: unknown) => {
      setState((current) => {
        if (current.status !== "ready" || !located) return current;
        const full = ["modules", located.moduleIndex, "lessons", located.lessonIndex, ...path];
        return { status: "ready", course: writePath(current.course, full, value) };
      });
      setDirty(true);
      setNote(null);
    },
    [located]
  );

  /**
   * Replaces the block list wholesale — add, delete, reorder.
   *
   * `renumberSteps` runs on every one of those, because all three move a
   * protocol step's position: `step` is derived from where the block sits, the
   * same way `order` is derived from where a lesson sits.
   */
  const editBlocks = useCallback(
    (next: (blocks: LessonBlock[]) => LessonBlock[]) => {
      setState((current) => {
        if (current.status !== "ready" || !located) return current;
        const path = ["modules", located.moduleIndex, "lessons", located.lessonIndex, "blocks"];
        const blocks = readPath(current.course, path) as LessonBlock[];
        return { status: "ready", course: writePath(current.course, path, renumberSteps(next(blocks))) };
      });
      setDirty(true);
      setNote(null);
    },
    [located]
  );

  // The browser's own guard. An author who edits a lesson on a phone and
  // switches apps should not lose the paragraph they just wrote to a reload.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const save = useCallback(async (): Promise<boolean> => {
    if (state.status !== "ready" || busy) return false;
    setBusy(true);
    setNote(null);

    const result = await saveCourse(slug, state.course);
    setBusy(false);

    if (!result.ok) {
      // Kept verbatim: a validation code names the exact block that is wrong.
      setNote(result.detail ?? "Не вдалося зберегти. Спробуйте ще раз.");
      return false;
    }

    setDirty(false);
    setNote(
      result.data.blockers.length === 0
        ? "Збережено. Блокерів немає."
        : `Збережено. Лишилось блокерів: ${result.data.blockers.length}.`
    );
    return true;
  }, [busy, slug, state]);

  /**
   * In-builder navigation, with the unsaved edit accounted for.
   *
   * `beforeunload` only covers a reload or a closed tab; a click on the next
   * lesson is a client-side route change the browser never asks about. Without
   * this, the arrows an author asked for would be the fastest way in the whole
   * tool to lose a paragraph. So a dirty editor holds the destination and asks,
   * with both honest answers offered — save and go, or go and drop it.
   */
  const navigate = useCallback(
    (href: string) => {
      setContentsOpen(false);
      if (dirty) {
        setPendingHref(href);
        return;
      }
      router.push(href);
    },
    [dirty, router]
  );

  const trail = [
    { label: "Курси", href: "/build" },
    { label: slug, href: `/build/${slug}` },
  ];

  if (state.status === "loading") {
    return (
      <BuilderShell trail={trail}>
        <BuilderNotice title="Завантажуємо урок…" />
      </BuilderShell>
    );
  }

  if (state.status === "failed") {
    return (
      <BuilderShell trail={trail}>
        <BuilderFailureNotice failure={state.failure} detail={state.detail} />
      </BuilderShell>
    );
  }

  if (!located) {
    return (
      <BuilderShell trail={trail}>
        <BuilderNotice title="Урок не знайдено" text={`У курсі немає уроку «${lessonSlug}».`} />
      </BuilderShell>
    );
  }

  const course = state.course;
  // Not named `module`: Next forbids shadowing the CommonJS global.
  const holder = course.modules[located.moduleIndex];
  const lesson = holder.lessons[located.lessonIndex] as Lesson;

  // The walk the author's own arrows follow: every lesson of the course in
  // stored order, reference modules included. The learner's sequence excludes
  // reference material; the AUTHOR's does not — a recipe list still has to be
  // reachable with one press from the lesson before it.
  const walk = flattenLessons(course);
  const position = walk.findIndex((entry) => entry.lesson.slug === lesson.slug);
  const previous = position > 0 ? walk[position - 1] : null;
  const next = position >= 0 && position < walk.length - 1 ? walk[position + 1] : null;

  return (
    <BuilderShell
      trail={[...trail, { label: lesson.slug }]}
      aside={<BuilderContents course={course} currentSlug={lesson.slug} onNavigate={navigate} />}
      asideOpen={contentsOpen}
      tools={
        <>
          <BuilderStep
            direction="prev"
            label={previous ? `Попередній урок: ${previous.lesson.title}` : "Попереднього уроку немає"}
            onNavigate={previous ? () => navigate(`/build/${slug}/${previous.lesson.slug}`) : undefined}
          />
          {/* Hidden from 901px up, where the rail is simply there. A control
              that toggles something already visible is a control that does
              nothing the first time it is pressed. */}
          <button
            className={styles.contentsAction}
            type="button"
            aria-expanded={contentsOpen}
            onClick={() => setContentsOpen((open) => !open)}
          >
            <Icon name="menu" size={18} />
            <span className={styles.contentsCount}>
              {position + 1}/{walk.length}
            </span>
          </button>
          <BuilderStep
            direction="next"
            label={next ? `Наступний урок: ${next.lesson.title}` : "Наступного уроку немає"}
            onNavigate={next ? () => navigate(`/build/${slug}/${next.lesson.slug}`) : undefined}
          />
        </>
      }
    >
      <div>
        <h1 className={styles.pageTitle}>{lesson.title}</h1>
        <p className={styles.pageLead}>
          {holder.title}
          {lesson.dayIndex ? ` · день ${lesson.dayIndex}` : ""}
        </p>
      </div>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Урок</h2>
        <FieldInput
          field={{ path: ["title"], label: "Назва", kind: "text" }}
          value={lesson.title}
          onChange={editLesson}
        />
        <FieldInput
          field={{
            path: ["dayIndex"],
            label: "День курсу",
            kind: "number",
            hint:
              course.schedule.mode === "daily"
                ? "День програми, а не порядковий номер уроку: пропуски тут нормальні й навмисні."
                : "Використовується лише в курсах з розкладом «по днях».",
          }}
          value={lesson.dayIndex}
          onChange={editLesson}
        />
        <FieldInput
          field={{ path: ["durationMin"], label: "Тривалість, хв", kind: "number" }}
          value={lesson.durationMin}
          onChange={editLesson}
        />
        <FieldInput
          field={{ path: ["summary"], label: "Короткий опис", kind: "inline", multiline: true }}
          value={lesson.summary}
          onChange={editLesson}
        />
        {/* Slug is shown and not editable. It is in every reminder already sent,
            every Telegram link and every bookmark, and renaming it here would
            break them all with no warning — a rename is a migration, not a
            text field. */}
        <p className={styles.readOnlyNote}>
          Адреса уроку: <code>/learn/{course.slug}/{lesson.slug}</code> — не змінюється, бо вона вже є в
          надісланих нагадуваннях і збережених посиланнях.
        </p>
      </section>

      <div className={styles.blockList} {...courseThemeAttributes(course.theme)}>
        {lesson.blocks.map((block, index) => (
          <BlockEditor
            key={block.id}
            block={block}
            index={index}
            total={lesson.blocks.length}
            onChange={editLesson}
            onBlocks={editBlocks}
          />
        ))}
      </div>

      <AddBlock onAdd={(type) => editBlocks((blocks) => [...blocks, newBlock(type, ids)])} />

      <div className={styles.saveBar}>
        {pendingHref ? (
          <>
            <span className={styles.saveState}>Є незбережені зміни.</span>
            <button
              className={styles.quietAction}
              type="button"
              onClick={() => {
                const href = pendingHref;
                setPendingHref(null);
                setDirty(false);
                router.push(href);
              }}
              disabled={busy}
            >
              Піти без збереження
            </button>
            <button
              className={styles.commitAction}
              type="button"
              onClick={async () => {
                const href = pendingHref;
                const saved = await save();
                if (!saved) return;
                setPendingHref(null);
                router.push(href);
              }}
              disabled={busy}
            >
              {busy ? "Зберігаємо…" : "Зберегти і перейти"}
            </button>
          </>
        ) : (
          <>
            <span className={styles.saveState}>{note ?? (dirty ? "Є незбережені зміни" : "Змін немає")}</span>
            <button className={styles.commitAction} type="button" onClick={save} disabled={busy || !dirty}>
              {busy ? "Зберігаємо…" : "Зберегти"}
            </button>
          </>
        )}
      </div>
    </BuilderShell>
  );
}

function locateLesson(course: Course, lessonSlug: string): { moduleIndex: number; lessonIndex: number } | null {
  for (let moduleIndex = 0; moduleIndex < course.modules.length; moduleIndex += 1) {
    const lessonIndex = course.modules[moduleIndex].lessons.findIndex((lesson) => lesson.slug === lessonSlug);
    if (lessonIndex >= 0) return { moduleIndex, lessonIndex };
  }
  return null;
}

/**
 * The block picker.
 *
 * Every type carries the sentence that says when to reach for it. A list of
 * eleven names is a menu; a list of eleven names with "коли" beside each is a
 * vocabulary, and the difference shows up as the author choosing «Практика»
 * where they meant «Крок протоколу».
 */
function AddBlock({ onAdd }: { onAdd: (type: LessonBlockType) => void }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button className={styles.addAction} type="button" onClick={() => setOpen(true)}>
        <span className={styles.addGlyph} aria-hidden="true">+</span> Додати блок
      </button>
    );
  }

  return (
    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Додати блок</h2>
        <button className={styles.quietAction} type="button" onClick={() => setOpen(false)}>
          Закрити
        </button>
      </div>
      <div className={styles.typeGrid}>
        {BLOCK_TYPE_ORDER.map((type) => (
          <button
            key={type}
            className={styles.typeOption}
            type="button"
            onClick={() => {
              onAdd(type);
              setOpen(false);
            }}
          >
            <span className={styles.typeName}>{BLOCK_TYPE_LABELS[type]}</span>
            <span className={styles.typeHint}>{BLOCK_TYPE_HINTS[type]}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function BlockEditor({
  block,
  index,
  total,
  onChange,
  onBlocks,
}: {
  block: LessonBlock;
  index: number;
  total: number;
  onChange: (path: (string | number)[], value: unknown) => void;
  onBlocks: (next: (blocks: LessonBlock[]) => LessonBlock[]) => void;
}) {
  const fields = describeBlock(block);
  const editField = (path: (string | number)[], value: unknown) => onChange(["blocks", index, ...path], value);

  return (
    <section className={styles.blockCard}>
      <div className={styles.blockHead}>
        <span className={styles.blockType}>{BLOCK_TYPE_LABELS[block.type]}</span>
        <BuilderMenu
          label={`Дії з блоком «${BLOCK_TYPE_LABELS[block.type]}»`}
          items={[
            { label: "Підняти вище", disabled: index === 0, onSelect: () => onBlocks((blocks) => moveItem(blocks, index, index - 1)) },
            { label: "Опустити нижче", disabled: index === total - 1, onSelect: () => onBlocks((blocks) => moveItem(blocks, index, index + 1)) },
            {
              label: "Видалити блок",
              danger: true,
              // A lesson with no blocks fails `validateCourse`, and the author
              // would meet that as a save error rather than a disabled item.
              disabled: total === 1,
              onSelect: () => onBlocks((blocks) => blocks.filter((_, position) => position !== index)),
            },
          ]}
        />
      </div>

      {block.type === "rich_text" ? (
        <RichTextEditor block={block} onChange={editField} />
      ) : (
        fields.map((field) => (
          <FieldInput key={field.path.join(".")} field={field} value={readPath(block, field.path)} onChange={editField} />
        ))
      )}

      <RepeatControls block={block} onChange={editField} />
      <BlockPreview block={block} />
    </section>
  );
}

const NODE_LABELS: Record<RichTextNode["kind"], string> = {
  p: "Абзац",
  h3: "Підзаголовок",
  ul: "Список",
  ol: "Нумерований список",
};

/**
 * The rich-text block, edited node by node.
 *
 * A `rich_text` block is a SEQUENCE of paragraphs, headings and lists, and the
 * flat field table cannot express "add a heading after this paragraph" — it can
 * only fill in the ones that already exist. Which is why the first builder pass
 * could edit two shipped courses and write no new prose at all.
 *
 * Turning a paragraph into a heading is a KIND change and not a new node: it
 * keeps the text the author already wrote, which is what "this line is actually
 * a heading" means.
 */
function RichTextEditor({
  block,
  onChange,
}: {
  block: Extract<LessonBlock, { type: "rich_text" }>;
  onChange: (path: (string | number)[], value: unknown) => void;
}) {
  const setContent = (next: RichTextNode[]) => onChange(["content"], next);

  return (
    <div className={styles.nodeList}>
      {block.content.map((node, index) => (
        <div className={styles.nodeCard} key={index}>
          <div className={styles.nodeHead}>
            <select
              className={styles.nodeKind}
              value={node.kind}
              aria-label={`Тип блоку ${index + 1}`}
              onChange={(event) => setContent(changeNodeKind(block.content, index, event.target.value as RichTextNode["kind"]))}
            >
              {(Object.keys(NODE_LABELS) as RichTextNode["kind"][]).map((kind) => (
                <option key={kind} value={kind}>
                  {NODE_LABELS[kind]}
                </option>
              ))}
            </select>
            <BuilderMenu
              label={`Дії з ${NODE_LABELS[node.kind].toLowerCase()}`}
              items={[
                { label: "Підняти вище", disabled: index === 0, onSelect: () => setContent(moveItem(block.content, index, index - 1)) },
                { label: "Опустити нижче", disabled: index === block.content.length - 1, onSelect: () => setContent(moveItem(block.content, index, index + 1)) },
                { label: "Видалити", danger: true, disabled: block.content.length === 1, onSelect: () => setContent(block.content.filter((_, position) => position !== index)) },
              ]}
            />
          </div>

          {node.kind === "ul" || node.kind === "ol" ? (
            <>
              {node.items.map((_, itemIndex) => (
                <div className={styles.itemRow} key={itemIndex}>
                  <FieldInput
                    field={{
                      path: ["content", index, "items", itemIndex],
                      label: `Пункт ${itemIndex + 1}`,
                      kind: "inline",
                      multiline: true,
                    }}
                    value={node.items[itemIndex]}
                    onChange={onChange}
                  />
                  <button
                    className={styles.iconAction}
                    type="button"
                    title="Видалити пункт"
                    aria-label={`Видалити пункт ${itemIndex + 1}`}
                    disabled={node.items.length === 1}
                    onClick={() =>
                      onChange(["content", index, "items"], node.items.filter((_, position) => position !== itemIndex))
                    }
                  >
                    <Icon name="close" size={18} />
                  </button>
                </div>
              ))}
              <button
                className={styles.addAction}
                type="button"
                onClick={() => onChange(["content", index, "items"], [...node.items, todo("пункт")])}
              >
                <span className={styles.addGlyph} aria-hidden="true">+</span> Пункт
              </button>
            </>
          ) : (
            <FieldInput
              field={{
                path: ["content", index, "text"],
                label: NODE_LABELS[node.kind],
                kind: "inline",
                multiline: node.kind !== "h3",
              }}
              value={node.text}
              onChange={onChange}
            />
          )}
        </div>
      ))}

      <div className={styles.nodeAdd}>
        {(Object.keys(NODE_LABELS) as RichTextNode["kind"][]).map((kind) => (
          <button
            key={kind}
            className={styles.addAction}
            type="button"
            onClick={() => setContent([...block.content, emptyNode(kind)])}
          >
            <span className={styles.addGlyph} aria-hidden="true">+</span> {NODE_LABELS[kind]}
          </button>
        ))}
      </div>
    </div>
  );
}

function emptyNode(kind: RichTextNode["kind"]): RichTextNode {
  if (kind === "ul" || kind === "ol") return { kind, items: [todo("пункт")] };
  if (kind === "h3") return { kind, text: todo("підзаголовок") };
  return { kind, text: todo("текст") };
}

/**
 * Changes a node's kind while keeping what the author wrote.
 *
 * Text becomes a one-item list; a list becomes its items joined by a line
 * break, which the inline model cannot carry — so they are joined with «; »
 * instead of silently dropping every item but the first.
 */
function changeNodeKind(content: RichTextNode[], index: number, kind: RichTextNode["kind"]): RichTextNode[] {
  const node = content[index];
  if (node.kind === kind) return content;

  const carried: RichTextNode =
    kind === "ul" || kind === "ol"
      ? { kind, items: node.kind === "ul" || node.kind === "ol" ? node.items : [node.text] }
      : {
          kind,
          text: node.kind === "ul" || node.kind === "ol" ? node.items.map(inlineToPlainText).join("; ") : node.text,
        };

  const next = [...content];
  next[index] = carried;
  return next;
}



/**
 * The "add another one" controls for blocks that hold a list of their own.
 *
 * Kept apart from the field table because they are structural: the table says
 * what an existing item's fields are, and nothing in it can say "there should
 * be a fourth item". Without these, a checklist authored with three items was
 * a checklist that could never have four.
 */
function RepeatControls({
  block,
  onChange,
}: {
  block: LessonBlock;
  onChange: (path: (string | number)[], value: unknown) => void;
}) {
  if (block.type === "checklist") {
    return (
      <div className={styles.nodeAdd}>
        <button
          className={styles.addAction}
          type="button"
          onClick={() => onChange(["items"], [...block.items, { id: ids(), text: todo("пункт") }])}
        >
          <span className={styles.addGlyph} aria-hidden="true">+</span> Пункт
        </button>
        <button
          className={styles.addAction}
          type="button"
          disabled={block.items.length === 1}
          onClick={() => onChange(["items"], block.items.slice(0, -1))}
        >
          − Останній пункт
        </button>
      </div>
    );
  }

  if (block.type === "faq_block") {
    return (
      <div className={styles.nodeAdd}>
        <button
          className={styles.addAction}
          type="button"
          onClick={() =>
            onChange(["items"], [...block.items, { id: ids(), question: todo("питання"), answer: todo("відповідь") }])
          }
        >
          <span className={styles.addGlyph} aria-hidden="true">+</span> Питання
        </button>
        <button
          className={styles.addAction}
          type="button"
          disabled={block.items.length === 1}
          onClick={() => onChange(["items"], block.items.slice(0, -1))}
        >
          − Останнє питання
        </button>
      </div>
    );
  }

  if (block.type === "table") {
    const columns = block.head?.length ?? block.rows[0]?.length ?? 1;
    return (
      <div className={styles.nodeAdd}>
        <button
          className={styles.addAction}
          type="button"
          onClick={() => onChange(["rows"], [...block.rows, newTableRow(columns)])}
        >
          <span className={styles.addGlyph} aria-hidden="true">+</span> Рядок
        </button>
        <button
          className={styles.addAction}
          type="button"
          disabled={block.rows.length === 1}
          onClick={() => onChange(["rows"], block.rows.slice(0, -1))}
        >
          − Останній рядок
        </button>
        {/* A column is added to the header AND to every row in one act: the
            validator rejects a ragged table, so doing either alone would
            produce a course that cannot be saved. A table with no header keeps
            none — growing one here would give it a single heading cell over N
            columns, which is the ragged shape from the other direction. */}
        <button
          className={styles.addAction}
          type="button"
          onClick={() => {
            if (block.head) onChange(["head"], [...block.head, todo(`колонка ${columns + 1}`)]);
            onChange(["rows"], block.rows.map((row) => [...row, todo("клітинка")]));
          }}
        >
          <span className={styles.addGlyph} aria-hidden="true">+</span> Колонка
        </button>
        <button
          className={styles.addAction}
          type="button"
          disabled={columns === 1}
          onClick={() => {
            if (block.head) onChange(["head"], block.head.slice(0, -1));
            onChange(["rows"], block.rows.map((row) => row.slice(0, -1)));
          }}
        >
          − Остання колонка
        </button>
      </div>
    );
  }

  return null;
}
