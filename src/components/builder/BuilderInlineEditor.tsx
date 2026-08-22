"use client";

/**
 * The inline editor — bold, italic and a link, applied to a selection.
 *
 * It replaces the markup dialect as the DEFAULT surface for `InlineText`. The
 * dialect worked and was provably total, but it asked the author to type
 * `**зірочки**`, which is the renderer's job handed to a person. The span model
 * has exactly three features, so a toolbar of three buttons maps onto it
 * without remainder — the same totality, with the syntax taken off the author.
 *
 * THE DIALECT STAYS, per field, behind «як текст». Not nostalgia: contenteditable
 * is genuinely unreliable on mobile Safari (selection handles, autocorrect
 * fighting the model, the keyboard covering the surface), and the builder is
 * explicitly meant to be usable on a phone. The escape hatch is the same tested
 * code path the CLI and the author's agent use.
 *
 * UNCONTROLLED ON PURPOSE. React must never write into this node while the
 * caret is in it — rewriting `innerHTML` under a live selection throws the
 * caret to the start on every keystroke. So the value flows in only when the
 * element is not focused, and out on every input.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { inlineToHtml, nodesToInline, type MarkupNode } from "@/lib/lms/inlineDom";
import { inlineToMarkup, markupToInline } from "@/lib/lms/inlineMarkup";
import { PLACEHOLDER_MARKER, inlineToPlainText, type InlineText } from "@/lms-core";
import styles from "./Builder.module.css";

/** The live DOM, read onto the pure node type the conversion understands. */
function readNodes(root: Node): MarkupNode[] {
  const out: MarkupNode[] = [];
  root.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out.push({ kind: "text", text: node.textContent ?? "" });
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as HTMLElement;
    const href = element.getAttribute("href");
    out.push({
      kind: "element",
      tag: element.tagName.toLowerCase(),
      ...(href ? { href } : {}),
      children: readNodes(element),
    });
  });
  return out;
}

/** The `<a>` the caret is inside, if any — so the link button can offer to remove it. */
function enclosingLink(root: HTMLElement): HTMLAnchorElement | null {
  const selection = window.getSelection();
  let node: Node | null = selection?.anchorNode ?? null;
  while (node && node !== root) {
    if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === "A") {
      return node as HTMLAnchorElement;
    }
    node = node.parentNode;
  }
  return null;
}

export function BuilderInlineEditor({
  value,
  multiline,
  label,
  onChange,
}: {
  value: InlineText | undefined;
  multiline?: boolean;
  label: string;
  onChange: (next: InlineText | undefined) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [asText, setAsText] = useState(false);
  const [linkDraft, setLinkDraft] = useState<string | null>(null);
  const savedRange = useRef<Range | null>(null);

  // The value flows IN only when the caret is elsewhere. Writing innerHTML
  // under a live selection is what makes naive contenteditable components jump
  // the caret to the start on every keystroke.
  useEffect(() => {
    const element = ref.current;
    if (!element || document.activeElement === element) return;
    const html = inlineToHtml(value ?? "");
    if (element.innerHTML !== html) element.innerHTML = html;
  }, [value, asText]);

  const emit = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    const next = nodesToInline(readNodes(element));
    // Empty is ABSENT, the same rule every other field follows: the validators
    // reject an empty string where they accept a missing key.
    onChange(next === "" ? undefined : next);
  }, [onChange]);

  const exec = (command: string, argument?: string) => {
    const element = ref.current;
    if (!element) return;
    element.focus();
    try {
      // Tags, not inline styles: `<span style="font-weight:700">` carries no
      // meaning the span model can read, and some browsers default to it.
      document.execCommand("styleWithCSS", false, "false");
      document.execCommand(command, false, argument);
    } catch {
      // execCommand is deprecated and may refuse; the text stays either way.
    }
    emit();
  };

  const plain = inlineToPlainText(value ?? "");
  const hasMarker = plain.includes(PLACEHOLDER_MARKER);

  if (asText) {
    return (
      <div className={styles.inlineField}>
        <div className={styles.inlineBar}>
          <span className={styles.inlineHint}>
            <code>**жирне**</code> · <code>*курсив*</code> · <code>[текст](посилання)</code>
          </span>
          <button className={styles.inlineToggle} type="button" onClick={() => setAsText(false)}>
            Кнопками
          </button>
        </div>
        <textarea
          className={`${styles.textarea} ${hasMarker ? styles.inputTodo : ""}`}
          aria-label={label}
          rows={multiline ? 3 : 2}
          value={inlineToMarkup(value ?? "")}
          onChange={(event) => {
            const next = markupToInline(event.target.value);
            onChange(next === "" ? undefined : next);
          }}
        />
      </div>
    );
  }

  return (
    <div className={styles.inlineField}>
      {/* The bar appears on focus rather than following the selection. A
          floating toolbar has to dodge the iOS selection handles, and it lands
          under the thumb that made the selection; a fixed row above the field
          is in the same place every time. */}
      {focused ? (
        <div className={styles.inlineBar}>
          <button
            className={styles.inlineToggle}
            type="button"
            title="Жирний"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => exec("bold")}
          >
            <b>Ж</b>
          </button>
          <button
            className={styles.inlineToggle}
            type="button"
            title="Курсив"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => exec("italic")}
          >
            <i>К</i>
          </button>
          <button
            className={styles.inlineToggle}
            type="button"
            title="Посилання"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              const element = ref.current;
              if (!element) return;
              const existing = enclosingLink(element);
              if (existing) {
                exec("unlink");
                return;
              }
              // The selection is lost the moment focus moves to the input, so
              // the range is kept and restored when the href is applied.
              const selection = window.getSelection();
              savedRange.current = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;
              setLinkDraft("");
            }}
          >
            Посилання
          </button>
          <span className={styles.barSpacer} />
          <button className={styles.inlineToggle} type="button" onClick={() => setAsText(true)}>
            Як текст
          </button>
        </div>
      ) : null}

      {linkDraft !== null ? (
        <div className={styles.inlineBar}>
          <input
            className={styles.input}
            type="text"
            autoFocus
            placeholder="/programs/way21 або https://…"
            aria-label="Адреса посилання"
            value={linkDraft}
            onChange={(event) => setLinkDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                applyLink();
              }
              if (event.key === "Escape") setLinkDraft(null);
            }}
          />
          <button className={styles.inlineToggle} type="button" onClick={applyLink}>
            Додати
          </button>
        </div>
      ) : null}

      <div
        ref={ref}
        className={`${styles.inlineSurface} ${hasMarker ? styles.inputTodo : ""}`}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline={false}
        aria-label={label}
        data-multiline={multiline || undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setLinkDraft(null);
        }}
        onInput={emit}
        onKeyDown={(event) => {
          // The span model has NO line break. A newline stored here renders as
          // a space for the learner, so allowing Enter would show the author a
          // paragraph break nobody else ever gets. A real break is a new node
          // in the rich-text block, which the editor offers a button for.
          if (event.key === "Enter") event.preventDefault();
        }}
        onPaste={(event) => {
          // Whatever was on the clipboard is arbitrary HTML. Only its text can
          // enter a model that knows three kinds of formatting.
          event.preventDefault();
          const text = event.clipboardData.getData("text/plain").replace(/\s+/g, " ");
          document.execCommand("insertText", false, text);
          emit();
        }}
      />
    </div>
  );

  function applyLink() {
    const href = (linkDraft ?? "").trim();
    setLinkDraft(null);
    if (href === "") return;

    const element = ref.current;
    const range = savedRange.current;
    if (!element || !range) return;

    element.focus();
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    exec("createLink", href);
  }
}
