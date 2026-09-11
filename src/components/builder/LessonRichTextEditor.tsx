"use client";

/**
 * The prose block's editor over BuilderInlineEditor.
 *
 * Split out of BuilderLessonEditor.tsx (1,871 lines, seven components) on 2026-09-10.
 */

import { useState } from "react";
import { inlineToPlainText, moveItem, type LessonBlock, type RichTextNode } from "@/lms-core";
import { BuilderMenu, type MenuItem } from "./BuilderMenu";
import { BuilderInlineEditor, type InternalReferenceOption, type SlashCommand } from "./BuilderInlineEditor";
import { BuilderGrip } from "./BuilderGrip";
import { landingIndex, useRowDrag, type DragRef } from "./useRowDrag";
import { BLOCK_TYPE_LABELS } from "./blockFields";
import styles from "./Builder.module.css";
import { changeNodeKind } from "@/lms-core/blockTransforms";
import { NODE_COMMANDS, NODE_ICONS, NODE_LABELS } from "./BuilderLessonEditor";

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
export function RichTextEditor({
  block,
  fresh,
  blockCommands,
  blockActions,
  referenceOptions,
  onBlockCommand,
  onChange,
}: {
  block: Extract<LessonBlock, { type: "rich_text" }>;
  fresh?: boolean;
  /** Offered in the slash menu below the node kinds — see `BlockEditor`. */
  blockCommands?: SlashCommand[];
  /**
   * The containing block's own actions.
   *
   * Prose draws no block rail of its own, so these ride along in every node's
   * menu as a second group. See the note at the rail's call site.
   */
  blockActions?: MenuItem[];
  referenceOptions: InternalReferenceOption[];
  onBlockCommand?: (id: string, index: number, commandNode?: RichTextNode) => void;
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
    setContent(moveItem(block.content, from.index, landingIndex(from.index, to.index, edge, true))),
  );

  const commands: SlashCommand[] = [...NODE_COMMANDS, ...(blockCommands ?? [])];

  const runCommand = (index: number, id: string, clearSlash = false, itemIndex = 0) => {
    const current = block.content[index];
    if (!current) return;
    const commandNode: RichTextNode | undefined = clearSlash
      ? current.kind === "ul" || current.kind === "ol"
        ? { ...current, items: current.items.map((item, i) => (i === itemIndex ? "" : item)) }
        : { ...current, text: "" }
      : undefined;
    if (id.startsWith("block:")) {
      onBlockCommand?.(id, index, commandNode);
      return;
    }
    const content = commandNode ? block.content.map((node, i) => (i === index ? commandNode : node)) : block.content;
    setContent(changeNodeKind(content, index, id as RichTextNode["kind"]));
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
      previous && (previous.kind === "ul" || previous.kind === "ol")
        ? `${target}:${previous.items.length - 1}`
        : `${target}`,
    );
  };

  /* What the second half of every node menu acts on, said in the block's own
     name rather than as the bare word «блок»: the author has one prose block
     open and several paragraphs inside it, and «БЛОК «ТЕКСТ»» names the object
     the document itself shows them. */
  const BLOCK_SECTION = `Блок «${BLOCK_TYPE_LABELS[block.type]}»`;

  return (
    <div className={styles.nodeList}>
      {block.content.map((node, index) => {
        const row: DragRef = { list: "node", group: 0, index };
        const isList = node.kind === "ul" || node.kind === "ol";
        /* «Цей абзац», «Цей список» — the kind the author is pointing at, not
           the generic «елемент». Every one of the four kinds is masculine, so
           «Цей» agrees with all of them. */
        const nodeSection = `Цей ${NODE_LABELS[node.kind].toLocaleLowerCase("uk")}`;

        return (
          <div className={`${styles.nodeCard} ${styles.dragRow}`} key={index} {...drag.rowProps(row)}>
            {/* Grip and menu, revealed by the row. A paragraph should look like
                a paragraph until the author reaches for it; the kind selector
                that used to sit here made every line of prose wear a form
                control. The kind now lives in the menu, where it is reachable
                by touch as well as by "/". */}
            <div className={styles.nodeHead}>
              {/* The handle, and nothing else. The kind was written beside it
                  in mono caps — «АБЗАЦ» over a paragraph, «СПИСОК» over a list
                  — which is the same filler the block heads carried: a list has
                  bullets and a subheading is bigger, so the label told the
                  author what they were already looking at. The menu still says
                  the kind, in the one place where it is a question. */}
              <BuilderGrip drag={drag} row={row} label={NODE_LABELS[node.kind]} />
              {/* TWO SUBJECTS, NAMED — see `MenuItem.section`.

                  This list acts on two different things: the paragraph under
                  the pointer, and the prose block that holds every paragraph in
                  it. They used to run together under one hairline, which left
                  «Видалити» and «Видалити блок» to tell themselves apart by a
                  single word — a distinction between losing a sentence and
                  losing the block. Each run now sits under a caption that says
                  what it acts on, so the subject is read before the verb. */}
              <BuilderMenu
                label={`Дії з ${NODE_LABELS[node.kind].toLowerCase()}`}
                items={[
                  /* The kinds wear the same glyphs the floating bar uses for the
                     same two commands. They were the only items in this list
                     with no icon at all, so a menu of seven rows drew four bare
                     labels and then three with marks — which reads as three
                     items that matter and four that do not. */
                  ...(Object.keys(NODE_LABELS) as RichTextNode["kind"][]).map((kind) => ({
                    label: NODE_LABELS[kind],
                    icon: NODE_ICONS[kind],
                    section: nodeSection,
                    disabled: kind === node.kind,
                    onSelect: () => runCommand(index, kind),
                  })),
                  /* Still `startsGroup`: same subject as the four above it, so
                     the break between «what this is» and «what to do with it»
                     stays a rule rather than a second caption. */
                  {
                    label: "Підняти вище",
                    icon: "arrow-up" as const,
                    section: nodeSection,
                    startsGroup: true,
                    disabled: index === 0,
                    onSelect: () => setContent(moveItem(block.content, index, index - 1)),
                  },
                  {
                    label: "Опустити нижче",
                    icon: "arrow-down" as const,
                    section: nodeSection,
                    disabled: index === block.content.length - 1,
                    onSelect: () => setContent(moveItem(block.content, index, index + 1)),
                  },
                  {
                    label: "Видалити",
                    icon: "trash" as const,
                    section: nodeSection,
                    danger: true,
                    disabled: block.content.length === 1,
                    onSelect: () => setContent(block.content.filter((_, position) => position !== index)),
                  },
                  /* The caption opens the group, so these no longer ask for a
                     rule of their own — two edges under one heading. */
                  ...(blockActions ?? []).map((action) => ({ ...action, section: BLOCK_SECTION })),
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
                      references={referenceOptions}
                      onCommand={(id, clearSlash) => runCommand(index, id, clearSlash, itemIndex)}
                      onChange={(next) =>
                        onChange(
                          ["content", index, "items"],
                          node.items.map((current, position) => (position === itemIndex ? (next ?? "") : current)),
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
                          node.items.filter((_, position) => position !== itemIndex),
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
                  references={referenceOptions}
                  onCommand={(id, clearSlash) => runCommand(index, id, clearSlash)}
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
        <span className={styles.addGlyph} aria-hidden="true">
          +
        </span>{" "}
        Абзац
      </button>
    </div>
  );
}
