"use client";

/**
 * One block, editable — and the composite that holds blocks, which is why the two live in one file: a composite renders blocks and a block renders composites.
 *
 * Split out of BuilderLessonEditor.tsx (1,871 lines, seven components) on 2026-09-10.
 */

import { useState } from "react";
import { BlockRenderer } from "@/components/lms/LessonBlocks";
import { buildInternalReferenceTargets, moveItem, newBlock, newTableRow, todo, type LessonBlock, type LessonBlockType } from "@/lms-core";
import { BuilderMenu, type MenuItem } from "./BuilderMenu";
import { FieldInput } from "./BuilderFields";
import { BuilderInlineEditor, type InternalReferenceOption } from "./BuilderInlineEditor";
import { BuilderBlockPicker } from "./BuilderBlockPicker";
import { BuilderGrip } from "./BuilderGrip";
import { landingIndex, useRowDrag, type DragRef, type RowDrag } from "./useRowDrag";
import { BLOCK_TYPE_LABELS, describeBlock, readPath, writePath } from "./blockFields";
import styles from "./Builder.module.css";
import { transformRichNode } from "@/lms-core/blockTransforms";
import { BLOCK_COMMANDS, ids } from "./BuilderLessonEditor";
import { RichTextEditor } from "./LessonRichTextEditor";

export function BlockEditor({
  block,
  index,
  total,
  drag,
  fresh,
  selected,
  referenceOptions,
  referenceTargets,
  courseSlug,
  onSelect,
  onProperties,
  onChange,
  onBlocks,
  onInsertAfter,
  depth = 0,
}: {
  block: LessonBlock;
  index: number;
  total: number;
  drag: RowDrag;
  /** Just added by the author — the caret belongs in its first node. */
  fresh?: boolean;
  selected?: boolean;
  referenceOptions: InternalReferenceOption[];
  referenceTargets: ReturnType<typeof buildInternalReferenceTargets>;
  courseSlug: string;
  onSelect: () => void;
  /** Selects the block AND brings its properties up in the tool panel. */
  onProperties: () => void;
  onChange: (path: (string | number)[], value: unknown) => void;
  onBlocks: (next: (blocks: LessonBlock[]) => LessonBlock[]) => void;
  onInsertAfter: (type: LessonBlockType) => void;
  depth?: number;
}) {
  const editField = (path: (string | number)[], value: unknown) => onChange(["blocks", index, ...path], value);

  /* The field descriptors are already the one place that knows what each
     address is CALLED; an empty leaf in the document borrows that name as its
     placeholder rather than inventing a second vocabulary. */
  const described = describeBlock(block);
  const labels = new Map(described.map((field) => [field.path.join("."), field.label]));
  /* What the rendering could not take over: numbers, media, links, flags — and
     any inline leaf the renderer never draws (`offPage`). They stay a short
     form under the block. */
  const residual = described.filter((field) => field.kind !== "inline" || field.offPage === true);

  const row: DragRef = { list: "block", group: 0, index };

  /* The block's own four, as data — a rail draws them for every type except
     rich text, which hands them to its paragraphs instead. Labels say «блок»
     out loud here: inside a node menu they sit under items about one paragraph,
     and «Видалити» / «Видалити блок» have to be tellable apart on sight. */
  const blockActions: MenuItem[] = [
    ...(block.type !== "group" && depth < 4 ? [{
      label: "Зібрати власний блок",
      icon: "plus" as const,
      onSelect: () => onBlocks((blocks) => blocks.map((current, position) => position === index
        ? { id: ids(), type: "group" as const, children: [current] } : current)),
    }] : []),
    ...(block.type === "group" ? [{
      label: "Розібрати на підблоки",
      icon: "list" as const,
      onSelect: () => onBlocks((blocks) => blocks.flatMap((current, position) => position === index && current.type === "group" ? current.children : [current])),
    }] : []),
    {
      label: "Властивості блоку",
      icon: "settings",
      hint: "Налаштування блоку в панелі праворуч",
      onSelect: onProperties,
    },
    { label: "Підняти блок вище", icon: "arrow-up", disabled: index === 0, onSelect: () => onBlocks((blocks) => moveItem(blocks, index, index - 1)) },
    { label: "Опустити блок нижче", icon: "arrow-down", disabled: index === total - 1, onSelect: () => onBlocks((blocks) => moveItem(blocks, index, index + 1)) },
    {
      label: "Видалити блок",
      icon: "trash",
      danger: true,
      // A lesson with no blocks fails `validateCourse`, and the author would
      // meet that as a save error rather than a disabled item.
      disabled: total === 1,
      onSelect: () => onBlocks((blocks) => blocks.filter((_, position) => position !== index)),
    },
  ];

  return (
    <section
      id={`block-${block.id}`}
      className={`${styles.blockCard} ${styles.dragRow}`}
      data-selected={selected || undefined}
      /* SELECTION FOLLOWS THE CARET, not only the pointer. A prose block has no
         read-only preview to click — its fields ARE its surface — so a click
         handler on the preview selected every block except the one an author
         spends most of their time in. Focus anywhere inside says «this is the
         block I mean» for every type, and typing is the strongest possible
         statement of that. */
      onFocusCapture={onSelect}
      {...drag.rowProps(row)}
    >
      {/* THE HANDLE RAIL, and it is not a header.
          It used to be a permanent row above every block carrying the type in
          mono caps — «МЕТА УРОКУ» over a lesson goal, «ТАБЛИЦЯ» over a table.
          The block already says what it is by being one, so the label was a
          line of filler on top of every block in the document, and the row it
          sat in pushed the content down by its own height on every block.
          What is left is the grip and the menu, in the margin, asked for by
          pointing at the block or selecting it. */}
      {/* ONE HANDLE PER PARAGRAPH, so prose has one rail and not two.

          A rich-text block CONTAINS the paragraphs, so it used to draw its own
          grip and menu in the outer gutter while every node inside drew another
          pair one indent in. Three «…» could be on screen at once — the block's,
          the node holding the caret, and the node under the pointer — all the
          same glyph at two indents, and nothing said which one would delete a
          sentence and which one the whole block. The author has to guess, and a
          menu you have to guess at is worse than a longer one.

          The block's own actions are handed to the nodes instead and open as a
          second group in the node menu, under a rule. THE COST, STATED: a
          rich-text block can no longer be dragged as a whole — its move is the
          menu's «Підняти блок вище / Опустити блок нижче». Nodes still drag
          within the block, and every other block type keeps its own rail. */}
      {block.type === "rich_text" ? null : (
        <div className={styles.blockRail} aria-hidden={undefined}>
          <BuilderGrip drag={drag} row={row} label={BLOCK_TYPE_LABELS[block.type]} />
          <BuilderMenu label={`Дії з блоком «${BLOCK_TYPE_LABELS[block.type]}»`} items={blockActions} />
        </div>
      )}

      {block.type === "group" ? (
        <CompositeEditor block={block} depth={depth} referenceOptions={referenceOptions} referenceTargets={referenceTargets} courseSlug={courseSlug}
          onUpdate={(update) => onBlocks((blocks) => blocks.map((current, position) => position === index && current.type === "group" ? { ...current, children: update(current.children) } : current))} />
      ) : block.type === "rich_text" ? (
        <RichTextEditor
          block={block}
          fresh={fresh}
          blockCommands={depth >= 4 ? BLOCK_COMMANDS.filter((command) => command.id !== "block:group") : BLOCK_COMMANDS}
          blockActions={blockActions}
          referenceOptions={referenceOptions}
          /* A block type chosen from inside the prose adds a NEW block after
             this one rather than converting it. Converting would throw away
             every paragraph the author had written to get here. */
          onBlockCommand={(id, nodeIndex, commandNode) => {
            const type = id.slice("block:".length) as LessonBlock["type"];
            if (type === "quote" || type === "code" || type === "checklist") {
              onBlocks((blocks) => blocks.flatMap((current, position) =>
                position === index && current.type === "rich_text"
                  ? transformRichNode(commandNode ? { ...current, content: current.content.map((node, i) => i === nodeIndex ? commandNode : node) } : current, nodeIndex, type, ids)
                  : [current]));
            } else if (commandNode) {
              onBlocks((blocks) => blocks.flatMap((current, position) => {
                if (position !== index || current.type !== "rich_text") return [current];
                const content = current.content.map((node, i) => i === nodeIndex ? commandNode : node);
                return [{ ...current, content }, newBlock(type, ids)];
              }));
            } else onInsertAfter(type);
          }}
          onChange={editField}
        />
      ) : (
        <>
          {/* THE BLOCK IS THE EDITOR. It is the learner's own rendering, with
              every addressed text leaf handed back as a field — so a table is
              typed in the table and a practice in the practice, at the size and
              face they will be read at. There is no editable twin of these
              thirteen types to drift away from the ones above. */}
          <div className={styles.builderLearnerBlock} onClick={onSelect}>
            <BlockRenderer
              block={block}
              checklist={{}}
              onToggleChecklistItem={() => undefined}
              disabled
              courseSlug={courseSlug}
              referenceTargets={referenceTargets}
              referenceRoute="build"
              authoring={{
                field: (path, value) => (
                  <BuilderInlineEditor
                    bare
                    phrasing
                    key={path.join(".")}
                    value={value}
                    label={labels.get(path.join(".")) ?? "Текст блоку"}
                    placeholder={labels.get(path.join(".")) ?? "Текст"}
                    references={referenceOptions}
                    onChange={(next) => editField(path, next)}
                  />
                ),
              }}
            />
          </div>
          {/* THE FIELDS ARE AT THE BLOCK, not in a panel beside it.
              They used to live in the right drawer, which meant editing the
              words of a table happened three hundred pixels away from the
              table — the author read one thing and typed into another, and
              the block they were changing was behind whichever panel state
              they had left open. Selecting the block opens them under it, in
              the document, in the place the change will appear. The drawer
              keeps what is genuinely a PROPERTY of the block rather than its
              content. */}
          {selected && residual.length > 0 ? (
            <div className={styles.blockFields}>
              {residual.map((field) => (
                <FieldInput
                  key={field.path.join(".")}
                  field={field}
                  value={readPath(block, field.path)}
                  courseSlug={courseSlug}
                  onChange={editField}
                />
              ))}
            </div>
          ) : null}
        </>
      )}

      {selected ? <RepeatControls block={block} onChange={editField} /> : null}
    </section>
  );
}

function CompositeEditor({ block, depth, referenceOptions, referenceTargets, courseSlug, onUpdate }: {
  block: Extract<LessonBlock, { type: "group" }>;
  depth: number;
  referenceOptions: InternalReferenceOption[];
  referenceTargets: ReturnType<typeof buildInternalReferenceTargets>;
  courseSlug: string;
  onUpdate: (update: (children: LessonBlock[]) => LessonBlock[]) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [picker, setPicker] = useState<DOMRect | null>(null);
  const drag = useRowDrag((from, to, edge) => onUpdate((children) => moveItem(children, from.index, landingIndex(from.index, to.index, edge, true))));
  return <div className={styles.compositeEditor} onDragStart={(event) => event.stopPropagation()} onDrop={(event) => event.stopPropagation()}>
    {block.children.map((child, index) => <BlockEditor key={child.id} block={child} index={index} total={block.children.length}
      depth={depth + 1} drag={drag} selected={selected === child.id} referenceOptions={referenceOptions} referenceTargets={referenceTargets} courseSlug={courseSlug}
      onSelect={() => setSelected(child.id)} onProperties={() => setSelected(child.id)}
      onChange={(path, value) => onUpdate((children) => writePath({ blocks: children }, path, value).blocks)}
      onBlocks={onUpdate}
      onInsertAfter={(type) => onUpdate((children) => [...children.slice(0, index + 1), newBlock(type, ids), ...children.slice(index + 1)])} />)}
    <button type="button" className={styles.addAction} onClick={(event) => setPicker(event.currentTarget.getBoundingClientRect())}>
      <span className={styles.addGlyph} aria-hidden="true">+</span> Підблок
    </button>
    {picker ? <BuilderBlockPicker anchor={picker} onClose={() => setPicker(null)} excludedTypes={depth >= 3 ? ["group"] : []}
      onPick={(type) => { onUpdate((children) => [...children, newBlock(type, ids)]); setPicker(null); }} /> : null}
  </div>;
}

export function internalReferenceOptions(
  targets: ReturnType<typeof buildInternalReferenceTargets>,
  currentLessonId: string,
  currentModuleId: string
): InternalReferenceOption[] {
  const current = targets.find((target) => target.kind === "lesson" && target.lessonId === currentLessonId);
  if (!current) return [];

  const rank = (target: (typeof targets)[number]): number => {
    if (target.lessonIndex === current.lessonIndex - 1) return 0;
    if (target.lessonIndex < current.lessonIndex) return 1;
    if (target.moduleId === currentModuleId) return 2;
    if (!target.referenceModule) return 3;
    return 4;
  };
  const group = (target: (typeof targets)[number]): string => {
    const value = rank(target);
    if (value === 0) return "Попередній урок";
    if (value === 1) return "Раніше в курсі";
    if (value === 2) return "Поточний модуль";
    if (value === 3) return "Увесь курс";
    return "Матеріали CenterWay";
  };

  return targets
    .filter((target) => target.lessonId !== currentLessonId)
    .sort((left, right) => {
      const groupOrder = rank(left) - rank(right);
      if (groupOrder !== 0) return groupOrder;
      if (rank(left) <= 1 && left.lessonIndex !== right.lessonIndex) return right.lessonIndex - left.lessonIndex;
      if (left.lessonIndex !== right.lessonIndex) return left.lessonIndex - right.lessonIndex;
      if (left.kind !== right.kind) return left.kind === "lesson" ? -1 : 1;
      return left.label.localeCompare(right.label, "uk");
    })
    .map((target) => ({
      key: target.key,
      label: target.label,
      group: group(target),
      hint: target.kind === "lesson"
        ? target.moduleTitle
        : `${target.lessonTitle} · ${target.moduleTitle}`,
      future: target.lessonIndex > current.lessonIndex && !target.referenceModule,
    }));
}

/**
 * Changes a node's kind while keeping what the author wrote.
 *
 * Text becomes a one-item list; a list becomes its items joined by a line
 * break, which the inline model cannot carry — so they are joined with «; »
 * instead of silently dropping every item but the first.
 */



/**
 * The "add another one" controls for blocks that hold a list of their own.
 *
 * Kept apart from the field table because they are structural: the table says
 * what an existing item's fields are, and nothing in it can say "there should
 * be a fourth item". Without these, a checklist authored with three items was
 * a checklist that could never have four.
 */
export function RepeatControls({
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
