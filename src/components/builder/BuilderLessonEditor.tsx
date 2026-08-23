"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Icon } from "@/components/Icon";
import {
  courseThemeAttributes,
  flattenLessons,
  inlineToPlainText,
  moveItem,
  PLACEHOLDER_MARKER,
  pruneEmptyProse,
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
import { BuilderInlineEditor, type SlashCommand } from "./BuilderInlineEditor";
import { BuilderEditableTitle } from "./BuilderEditableTitle";
import { BlockPreview } from "./BuilderBlockPreview";
import { loadCourse, saveCourse, type BuilderFailure } from "./builderClient";
import { BuilderGrip } from "./BuilderGrip";
import { BuilderHistory } from "./BuilderHistory";
import { useCourseHistory } from "./useCourseHistory";
import { landingIndex, useRowDrag, type DragRef, type DropEdge, type RowDrag } from "./useRowDrag";
import {
  BLOCK_TYPE_HINTS,
  BLOCK_TYPE_LABELS,
  BLOCK_STRUCTURE_ORDER,
  BLOCK_TEMPLATE_ORDER,
  describeBlock,
  readPath,
  writePath,
} from "./blockFields";
import styles from "./Builder.module.css";
import { PlatformLoadingState } from "@/components/platform/PlatformLoadingState";

type State =
  | { status: "loading" }
  | { status: "failed"; failure: BuilderFailure; detail?: string }
  | { status: "ready" };

const ids = () => crypto.randomUUID();
const trailTitle = (value: string, fallback: string) =>
  value.includes(PLACEHOLDER_MARKER) || value.trim() === "" ? fallback : value;

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
  const history = useCourseHistory();
  const { course, dirty } = history;
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [contentsOpen, setContentsOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  /** The block just created, so the caret can land in it instead of being aimed. */
  const [freshBlockId, setFreshBlockId] = useState<string | null>(null);

  useEffect(() => {
    // Guarded, and awaiting before the first setState: a synchronous setState in
    // an effect cascades a render for a state the component already starts in.
    let cancelled = false;
    void (async () => {
      const result = await loadCourse(slug);
      if (cancelled) return;
      if (result.ok) history.reset(result.data.course);
      setState(
        result.ok
          ? { status: "ready" }
          : { status: "failed", failure: result.failure, detail: result.detail }
      );
    })();
    return () => {
      cancelled = true;
    };
    // `history.reset` is stable; the course is reloaded only when the slug changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Plain derivation, not memoized: it is two array scans over a handful of
  // modules, and the shape the compiler could not memoize anyway.
  const located = course ? locateLesson(course, lessonSlug) : null;

  /** Applies a change to one path inside the current lesson. */
  const editLesson = useCallback(
    (path: (string | number)[], value: unknown) => {
      if (!located) return;
      const full = ["modules", located.moduleIndex, "lessons", located.lessonIndex, ...path];
      // Coalesced by the path being written: a burst of typing in one field is
      // one undo, and moving to the next field starts a new one.
      history.edit(full.join("."), (current) => writePath(current, full, value));
      setNote(null);
    },
    [history, located]
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
      if (!located) return;
      const path = ["modules", located.moduleIndex, "lessons", located.lessonIndex, "blocks"];
      // No coalescing key: adding, deleting and reordering a block are each one
      // deliberate act, and merging two of them would take back a move the
      // author never asked to lose.
      history.edit(null, (current) =>
        writePath(current, path, renumberSteps(next(readPath(current, path) as LessonBlock[])))
      );
      setNote(null);
    },
    [history, located]
  );

  /** Blocks reorder within the lesson. Steps renumber on the way, as with the arrows. */
  const blockDrag = useRowDrag(
    useCallback(
      (from: DragRef, to: DragRef, edge: DropEdge) => {
        editBlocks((blocks) => moveItem(blocks, from.index, landingIndex(from.index, to.index, edge, true)));
      },
      [editBlocks]
    )
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
    if (!course || busy) return false;
    setBusy(true);
    setNote(null);

    const result = await saveCourse(slug, pruneEmptyProse(course));
    setBusy(false);

    if (!result.ok) {
      // Kept verbatim: a validation code names the exact block that is wrong.
      setNote(result.detail ?? "Не вдалося зберегти. Спробуйте ще раз.");
      return false;
    }

    history.markClean();
    setNote(
      result.data.blockers.length === 0
        ? "Збережено. Блокерів немає."
        : `Збережено. Лишилось блокерів: ${result.data.blockers.length}.`
    );
    return true;
  }, [busy, course, history, slug]);

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

  const preview = () => {
    if (busy) return;
    if (dirty) {
      setNote("Спочатку збережіть зміни, щоб відкрити перегляд.");
      return;
    }
    window.open(`/learn/${encodeURIComponent(slug)}/${encodeURIComponent(lessonSlug)}`, "_blank", "noopener,noreferrer");
  };

  const trail = [
    { label: "Курси", href: "/build" },
    { label: slug, href: `/build/${slug}` },
  ];

  if (state.status === "loading") {
    return (
      <BuilderShell trail={trail}>
        <PlatformLoadingState label="Білдер" title="Завантажуємо урок…" detail="Відновлюємо блоки уроку і останню збережену версію." />
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

  if (!course || !located) {
    return (
      <BuilderShell trail={trail}>
        <BuilderNotice title="Урок не знайдено" text={`У курсі немає уроку «${lessonSlug}».`} />
      </BuilderShell>
    );
  }

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
      trail={[
        { label: "Курси", href: "/build" },
        { label: trailTitle(course.title, "Курс без назви"), href: `/build/${slug}` },
        { label: trailTitle(lesson.title, "Урок без назви") },
      ]}
      aside={<BuilderContents course={course} currentSlug={lesson.slug} onNavigate={navigate} />}
      asideOpen={contentsOpen}
      tools={
        <>
          <button className={styles.quietAction} type="button" onClick={preview} disabled={busy} title={dirty ? "Спочатку збережіть зміни" : "Відкрити урок як учень"}>
            Переглянути
          </button>
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
      {/* THE DOCUMENT HEAD, and it is the document. The title used to be an
          `<h1>` echoing a «Назва» field in a panel below it: the same words
          twice, with the copy being the one you could change. Now the heading
          IS the input, and the lead under it is the lesson's own summary
          rather than a caption about it. */}
      <div className={styles.docHead}>
        <BuilderEditableTitle
          value={lesson.title}
          label="Редагувати назву уроку"
          onChange={(value) => editLesson(["title"], value)}
        />
        <p className={styles.docMeta}>
          {holder.title}
          {lesson.dayIndex ? ` · день ${lesson.dayIndex}` : ""}
        </p>
        <div className={styles.pageLead}>
          <BuilderInlineEditor
            bare
            multiline
            value={lesson.summary}
            label="Короткий опис уроку"
            placeholder="Про що цей урок — одне-два речення."
            onChange={(next) => editLesson(["summary"], next)}
          />
        </div>
      </div>

      <section className={styles.panel}>
        <h2 className={styles.panelTitle}>Урок</h2>
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
            drag={blockDrag}
            fresh={block.id === freshBlockId}
            courseSlug={course.slug}
            onChange={editLesson}
            onBlocks={editBlocks}
          />
        ))}
      </div>

      <AddBlock
        onAdd={(type) => {
          // A text block starts EMPTY, not with a `[ЗАПОВНИ: текст]` marker the
          // author has to select and delete before typing. Empty prose cannot
          // be saved — `pruneEmptyProse` is what makes that safe, by dropping
          // on the way out whatever was never written.
          const block = type === "rich_text" ? { id: ids(), type, content: [{ kind: "p" as const, text: "" }] } : newBlock(type, ids);
          setFreshBlockId(block.id);
          editBlocks((blocks) => [...blocks, block]);
        }}
      />

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
                history.markClean();
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
            <BuilderHistory history={history} disabled={busy} />
            <span className={styles.saveState}>{note ?? (dirty ? "Не збережено" : "Збережено")}</span>
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
 * Adding to the lesson.
 *
 * IT USED TO ASK FIRST. The one control here opened a grid of twelve cards and
 * would not let a word be written until one was chosen — a lesson began with a
 * taxonomy question. An author does not know what kind of thing they are
 * writing before they have written it.
 *
 * So the default is text, immediately, with the caret in it. The SHAPES a
 * paragraph cannot take are one "/" away. And the third door, here, is for
 * TEMPLATES — the blocks that arrive already knowing what job they do. That is
 * a different question, deliberately asked in a different place: choosing
 * «Крок протоколу» is a decision about the lesson's structure, and the grid,
 * with the sentence that says when to reach for each, is the right shape for a
 * decision. It is the wrong shape for "I need a table here".
 */
function AddBlock({ onAdd }: { onAdd: (type: LessonBlockType) => void }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className={styles.addRow}>
        <button className={styles.addAction} type="button" onClick={() => onAdd("rich_text")}>
          <span className={styles.addGlyph} aria-hidden="true">+</span> Додати текст
        </button>
        <button className={styles.quietAction} type="button" onClick={() => setOpen(true)}>
          Шаблон…
        </button>
      </div>
    );
  }

  const pick = (type: LessonBlockType) => {
    onAdd(type);
    setOpen(false);
  };

  return (
    <section className={styles.panel}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Шаблони</h2>
        <button className={styles.quietAction} type="button" onClick={() => setOpen(false)}>
          Закрити
        </button>
      </div>
      <p className={styles.panelText}>
        Блок, який уже знає, що він робить в уроці. Плеєр учня малює кожен по-своєму, а перевірка готовності
        деякі з них вимагає.
      </p>
      <div className={styles.typeGrid}>
        {BLOCK_TEMPLATE_ORDER.map((type) => (
          <button key={type} className={styles.typeOption} type="button" onClick={() => pick(type)}>
            <span className={styles.typeName}>{BLOCK_TYPE_LABELS[type]}</span>
            <span className={styles.typeHint}>{BLOCK_TYPE_HINTS[type]}</span>
          </button>
        ))}
      </div>

      {/* The same shapes "/" offers, kept reachable without typing — on a touch
          keyboard the slash is two taps away, and this is the screen an author
          is already on when they realise they want a table. */}
      <h3 className={styles.panelTitle}>Блоки</h3>
      <div className={styles.typeGrid}>
        {BLOCK_STRUCTURE_ORDER.map((type) => (
          <button key={type} className={styles.typeOption} type="button" onClick={() => pick(type)}>
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
  drag,
  fresh,
  courseSlug,
  onChange,
  onBlocks,
}: {
  block: LessonBlock;
  index: number;
  total: number;
  drag: RowDrag;
  /** Where an uploaded image lands. Only the image block uses it. */
  courseSlug: string;
  /** Just added by the author — the caret belongs in its first node. */
  fresh?: boolean;
  onChange: (path: (string | number)[], value: unknown) => void;
  onBlocks: (next: (blocks: LessonBlock[]) => LessonBlock[]) => void;
}) {
  const fields = describeBlock(block);
  const editField = (path: (string | number)[], value: unknown) => onChange(["blocks", index, ...path], value);

  const row: DragRef = { list: "block", group: 0, index };

  return (
    <section className={`${styles.blockCard} ${styles.dragRow}`} {...drag.rowProps(row)}>
      <div className={styles.blockHead}>
        <BuilderGrip drag={drag} row={row} label={BLOCK_TYPE_LABELS[block.type]} />
        <span className={styles.blockType}>{BLOCK_TYPE_LABELS[block.type]}</span>
        <BuilderMenu
          label={`Дії з блоком «${BLOCK_TYPE_LABELS[block.type]}»`}
          items={[
            { label: "Підняти вище", icon: "arrow-up" as const, disabled: index === 0, onSelect: () => onBlocks((blocks) => moveItem(blocks, index, index - 1)) },
            { label: "Опустити нижче", icon: "arrow-down" as const, disabled: index === total - 1, onSelect: () => onBlocks((blocks) => moveItem(blocks, index, index + 1)) },
            {
              label: "Видалити блок",
              icon: "trash",
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
        <RichTextEditor
          block={block}
          fresh={fresh}
          blockCommands={BLOCK_COMMANDS}
          /* A block type chosen from inside the prose adds a NEW block after
             this one rather than converting it. Converting would throw away
             every paragraph the author had written to get here. */
          onBlockCommand={(id) => {
            const type = id.slice("block:".length) as LessonBlock["type"];
            onBlocks((blocks) => [
              ...blocks.slice(0, index + 1),
              newBlock(type, ids),
              ...blocks.slice(index + 1),
            ]);
          }}
          onChange={editField}
        />
      ) : (
        fields.map((field) => (
          <FieldInput
            key={field.path.join(".")}
            field={field}
            value={readPath(block, field.path)}
            courseSlug={courseSlug}
            onChange={editField}
          />
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
 * What "/" offers first: the four shapes a paragraph can become.
 *
 * These change the node in place and keep the words. The block types the
 * lesson also knows come after them, added by `BlockEditor`, because reaching
 * for «Таблиця» halfway through a sentence is rarer than reaching for a list.
 */
/**
 * The shapes prose cannot take, offered under the node kinds.
 *
 * STRUCTURE ONLY — a table, a video, an image, a quote, a button. The blocks
 * that arrive carrying a ROLE (мета уроку, крок протоколу, чек-лист, межі) are
 * templates, not shapes, and they are NOT here: mid-sentence the author is
 * asking "what shape is this", and a list that answers two questions at once
 * makes both answers harder to find. Templates live behind «Шаблон…».
 */
const BLOCK_COMMANDS: SlashCommand[] = BLOCK_STRUCTURE_ORDER.map((type) => ({
  id: `block:${type}`,
  label: BLOCK_TYPE_LABELS[type],
  hint: BLOCK_TYPE_HINTS[type],
}));

const NODE_COMMANDS: SlashCommand[] = [
  { id: "p", label: "Абзац", hint: "Звичайний текст." },
  { id: "h3", label: "Підзаголовок", hint: "Ділить урок на частини." },
  { id: "ul", label: "Список", hint: "Перелік, у якому порядок не важить." },
  { id: "ol", label: "Нумерований список", hint: "Кроки, які йдуть по черзі." },
];

/**
 * The rich-text block, edited as a document rather than as a form over one.
 *
 * A `rich_text` block is a SEQUENCE of paragraphs, headings and lists. It used
 * to be drawn as a stack of labelled fields with a kind dropdown on each — a
 * form whose subject happened to be prose. Now the node renders AS the thing it
 * is, Enter makes the next one, and the controls that describe it (kind, move,
 * delete) hide until the pointer is on the row.
 *
 * THE THREE DOCUMENT KEYS. Enter opens the next node — a new paragraph after a
 * paragraph, the next item inside a list, and, on an already-empty item, the
 * way OUT of the list into a paragraph, because a list with no exit is a trap.
 * Backspace on an empty node removes it and puts the caret at the end of the
 * one before. "/" opens the menu. None of that is decided by the field itself:
 * the field hands the key up (see `BuilderInlineEditor`) and this component,
 * which knows the sequence, decides what the key meant.
 *
 * Turning a paragraph into a heading is a KIND change and not a new node: it
 * keeps the text the author already wrote, which is what "this line is actually
 * a heading" means.
 */
function RichTextEditor({
  block,
  fresh,
  blockCommands,
  onBlockCommand,
  onChange,
}: {
  block: Extract<LessonBlock, { type: "rich_text" }>;
  fresh?: boolean;
  /** Offered in the slash menu below the node kinds — see `BlockEditor`. */
  blockCommands?: SlashCommand[];
  onBlockCommand?: (id: string) => void;
  onChange: (path: (string | number)[], value: unknown) => void;
}) {
  const setContent = (next: RichTextNode[]) => onChange(["content"], next);

  /**
   * Which field should hold the caret after the next render.
   *
   * An address, not a ref: the node that needs focus usually does not exist yet
   * when the key is pressed. `"2"` is the third node, `"2:1"` its second item.
   */
  const [focus, setFocus] = useState<string | null>(fresh ? "0" : null);

  /**
   * Nodes reorder within their own block only.
   *
   * No `crossGroup`: one rich-text block is on screen per card, and a node
   * carried into a neighbouring block would be a move between two different
   * pieces of prose — a thing the author would have to undo more often than
   * they meant it. The block itself is the unit that travels.
   */
  const drag = useRowDrag((from, to, edge) =>
    setContent(moveItem(block.content, from.index, landingIndex(from.index, to.index, edge, true)))
  );

  const commands: SlashCommand[] = [...NODE_COMMANDS, ...(blockCommands ?? [])];

  const runCommand = (index: number, id: string) => {
    if (id.startsWith("block:")) {
      onBlockCommand?.(id);
      return;
    }
    setContent(changeNodeKind(block.content, index, id as RichTextNode["kind"]));
    setFocus(id === "ul" || id === "ol" ? `${index}:0` : `${index}`);
  };

  /** A new paragraph after `index`, which is what Enter means outside a list. */
  const openParagraph = (index: number) => {
    const next = [...block.content];
    next.splice(index + 1, 0, { kind: "p", text: "" });
    setContent(next);
    setFocus(`${index + 1}`);
  };

  const removeNode = (index: number) => {
    if (block.content.length === 1) return;
    setContent(block.content.filter((_, position) => position !== index));
    // The end of what came before — where the caret would have gone if the
    // empty node had never been there.
    const target = Math.max(0, index - 1);
    const previous = block.content[target];
    setFocus(
      previous.kind === "ul" || previous.kind === "ol" ? `${target}:${previous.items.length - 1}` : `${target}`
    );
  };

  return (
    <div className={styles.nodeList}>
      {block.content.map((node, index) => {
        const row: DragRef = { list: "node", group: 0, index };
        const isList = node.kind === "ul" || node.kind === "ol";

        return (
          <div className={`${styles.nodeCard} ${styles.dragRow}`} key={index} {...drag.rowProps(row)}>
            {/* Grip and menu, revealed by the row. A paragraph should look like
                a paragraph until the author reaches for it; the kind selector
                that used to sit here made every line of prose wear a form
                control. The kind now lives in the menu, where it is reachable
                by touch as well as by "/". */}
            <div className={styles.nodeHead}>
              <BuilderGrip drag={drag} row={row} label={NODE_LABELS[node.kind]} />
              <span className={styles.nodeKindName}>{NODE_LABELS[node.kind]}</span>
              <BuilderMenu
                label={`Дії з ${NODE_LABELS[node.kind].toLowerCase()}`}
                items={[
                  ...(Object.keys(NODE_LABELS) as RichTextNode["kind"][]).map((kind) => ({
                    label: NODE_LABELS[kind],
                    disabled: kind === node.kind,
                    onSelect: () => runCommand(index, kind),
                  })),
                  { label: "Підняти вище", icon: "arrow-up" as const, disabled: index === 0, onSelect: () => setContent(moveItem(block.content, index, index - 1)) },
                  { label: "Опустити нижче", icon: "arrow-down" as const, disabled: index === block.content.length - 1, onSelect: () => setContent(moveItem(block.content, index, index + 1)) },
                  { label: "Видалити", icon: "trash" as const, danger: true, disabled: block.content.length === 1, onSelect: () => setContent(block.content.filter((_, position) => position !== index)) },
                ]}
              />
            </div>

            {isList ? (
              <ul className={node.kind === "ol" ? styles.nodeOl : styles.nodeUl}>
                {node.items.map((item, itemIndex) => (
                  <li className={styles.nodeItem} key={itemIndex}>
                    <BuilderInlineEditor
                      bare
                      value={item}
                      label={`${NODE_LABELS[node.kind]} — пункт ${itemIndex + 1}`}
                      placeholder={itemIndex === 0 ? "Пункт" : undefined}
                      autoFocus={focus === `${index}:${itemIndex}`}
                      commands={commands}
                      onCommand={(id) => runCommand(index, id)}
                      onChange={(next) =>
                        onChange(
                          ["content", index, "items"],
                          node.items.map((current, position) => (position === itemIndex ? next ?? "" : current))
                        )
                      }
                      onEnter={() => {
                        // An empty item means "I am done with this list". The
                        // item goes and a paragraph opens after the whole node,
                        // which is the only exit a list has.
                        if (inlineToPlainText(item ?? "") === "" && node.items.length > 1) {
                          const trimmed = node.items.filter((_, position) => position !== itemIndex);
                          const next = [...block.content];
                          next[index] = { kind: node.kind, items: trimmed };
                          next.splice(index + 1, 0, { kind: "p", text: "" });
                          setContent(next);
                          setFocus(`${index + 1}`);
                          return;
                        }
                        const items = [...node.items];
                        items.splice(itemIndex + 1, 0, "");
                        onChange(["content", index, "items"], items);
                        setFocus(`${index}:${itemIndex + 1}`);
                      }}
                      onEmptyBackspace={() => {
                        if (node.items.length === 1) {
                          // The last item of a list is not deleted, it is
                          // demoted: a list of nothing is not a shape the
                          // validator accepts, and an author pressing backspace
                          // means "this is not a list", not "erase this".
                          setContent(changeNodeKind(block.content, index, "p"));
                          setFocus(`${index}`);
                          return;
                        }
                        onChange(
                          ["content", index, "items"],
                          node.items.filter((_, position) => position !== itemIndex)
                        );
                        setFocus(`${index}:${Math.max(0, itemIndex - 1)}`);
                      }}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <div className={node.kind === "h3" ? styles.nodeHeading : undefined}>
                <BuilderInlineEditor
                  bare
                  multiline={node.kind !== "h3"}
                  value={node.text}
                  label={NODE_LABELS[node.kind]}
                  placeholder={node.kind === "h3" ? "Підзаголовок" : "Пишіть, або «/» для команд"}
                  autoFocus={focus === `${index}`}
                  commands={commands}
                  onCommand={(id) => runCommand(index, id)}
                  onChange={(next) => onChange(["content", index, "text"], next ?? "")}
                  onEnter={() => openParagraph(index)}
                  onEmptyBackspace={() => removeNode(index)}
                />
              </div>
            )}
          </div>
        );
      })}

      {/* The only add control left. Everything else the author might want here
          is one "/" away, and a row of four buttons under every block was the
          picker problem in miniature: choose the shape before writing a word. */}
      <button className={styles.addAction} type="button" onClick={() => openParagraph(block.content.length - 1)}>
        <span className={styles.addGlyph} aria-hidden="true">+</span> Абзац
      </button>
    </div>
  );
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
