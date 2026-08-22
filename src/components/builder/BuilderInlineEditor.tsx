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
 *
 * IT IS ALSO WHERE THE DOCUMENT KEYS LIVE. Enter, Backspace-on-empty and the
 * slash menu are all offered as callbacks rather than handled here: this
 * component knows about one span of text and nothing about what surrounds it,
 * and the thing that knows whether Enter means "next paragraph", "next list
 * item" or nothing at all is the list the field sits in. Handing it the keys
 * and keeping the structure out is what lets one editor serve a lesson title, a
 * checklist item and a paragraph without branching on which it is.
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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

/** One entry of the slash menu. `id` is handed back verbatim to the owner. */
export type SlashCommand = {
  id: string;
  label: string;
  /** The sentence that says when to reach for it — the picker's whole point. */
  hint?: string;
};

export function BuilderInlineEditor({
  value,
  multiline,
  label,
  placeholder,
  autoFocus,
  bare,
  commands,
  onChange,
  onCommand,
  onEnter,
  onEmptyBackspace,
}: {
  value: InlineText | undefined;
  multiline?: boolean;
  label: string;
  /** Shown while the field is empty. The prompt is the field, not a caption above it. */
  placeholder?: string;
  /** Focus on mount — a node the author just created by pressing Enter. */
  autoFocus?: boolean;
  /** Drops the plate and the frame: the field IS the paragraph, not a box holding one. */
  bare?: boolean;
  /** Offered when the author types "/" into an empty field. */
  commands?: SlashCommand[];
  onChange: (next: InlineText | undefined) => void;
  onCommand?: (id: string) => void;
  /** Enter. The span model has no line break, so this is always a structural move. */
  onEnter?: () => void;
  /** Backspace with nothing left to delete — "join me to what came before". */
  onEmptyBackspace?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [asText, setAsText] = useState(false);
  const [linkDraft, setLinkDraft] = useState<string | null>(null);
  /** Whether the surface currently holds anything — what decides the placeholder. */
  const [hasText, setHasText] = useState(false);
  const savedRange = useRef<Range | null>(null);

  /**
   * The slash menu.
   *
   * `query` is null when it is shut. It opens on a "/" typed into an EMPTY
   * field and closes the moment the text stops looking like a command — so it
   * can never sit on top of real prose, and a slash written mid-sentence is
   * just a slash.
   */
  const [query, setQuery] = useState<string | null>(null);
  const [cursor, setCursor] = useState(0);
  const [anchor, setAnchor] = useState<{ top: number; left: number; width: number } | null>(null);

  const matches = (commands ?? []).filter(
    (command) => query !== null && command.label.toLowerCase().includes(query.toLowerCase())
  );
  // Clamped rather than reset: narrowing the query must not silently move the
  // highlight back to the top under an author who is about to press Enter.
  const active = matches.length > 0 ? Math.min(cursor, matches.length - 1) : 0;

  const closeMenu = useCallback(() => {
    setQuery(null);
    setCursor(0);
    setAnchor(null);
  }, []);

  /** Clears the "/query" the author typed and hands the choice to the owner. */
  const runCommand = useCallback(
    (id: string) => {
      const element = ref.current;
      if (element) element.innerHTML = "";
      closeMenu();
      onChange(undefined);
      onCommand?.(id);
    },
    [closeMenu, onChange, onCommand]
  );

  // Measured rather than declared, and fixed rather than absolute — the same
  // reason the row menu is (see BuilderMenu): a list positioned inside a card
  // is clipped by the first ancestor that scrolls.
  useLayoutEffect(() => {
    if (query === null) return;
    const element = ref.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    setAnchor({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }, [query]);

  // A field the author has just created by pressing Enter. Focus lands at the
  // end so typing continues where they were, not before what is already there.
  useEffect(() => {
    if (!autoFocus) return;
    const element = ref.current;
    if (!element) return;
    element.focus();
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
  }, [autoFocus]);

  // The value flows IN only when the caret is elsewhere. Writing innerHTML
  // under a live selection is what makes naive contenteditable components jump
  // the caret to the start on every keystroke.
  useEffect(() => {
    const element = ref.current;
    if (!element || document.activeElement === element) return;
    const html = inlineToHtml(value ?? "");
    if (element.innerHTML !== html) element.innerHTML = html;
    setHasText((element.textContent ?? "") !== "");
  }, [value, asText]);

  const emit = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    const raw = element.textContent ?? "";
    setHasText(raw !== "");

    // A slash typed into an empty field opens the menu, and what follows it
    // filters. The moment the text stops looking like a command the menu shuts
    // and the text is written through — so a slash inside a sentence is a slash.
    const slash = commands && commands.length > 0 ? /^\/([^\s/]*)$/.exec(raw) : null;
    if (slash) {
      setQuery(slash[1]);
      setCursor(0);
      // Deliberately NOT written to the model: a half-typed command is not
      // content, and recording it would put "/" on the undo stack and, if the
      // author walked away mid-command, into the saved course.
      return;
    }

    closeMenu();
    const next = nodesToInline(readNodes(element));
    // Empty is ABSENT, the same rule every other field follows: the validators
    // reject an empty string where they accept a missing key.
    onChange(next === "" ? undefined : next);
  }, [closeMenu, commands, onChange]);

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
        className={`${bare ? styles.inlineBare : styles.inlineSurface} ${hasMarker ? styles.inputTodo : ""}`}
        data-placeholder={placeholder}
        data-empty={!hasText || undefined}
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
          closeMenu();
        }}
        onInput={emit}
        onKeyDown={(event) => {
          if (query !== null && matches.length > 0) {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setCursor((active + 1) % matches.length);
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setCursor((active - 1 + matches.length) % matches.length);
              return;
            }
            if (event.key === "Enter" || event.key === "Tab") {
              event.preventDefault();
              runCommand(matches[active].id);
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              closeMenu();
              return;
            }
          }

          // The span model has NO line break. A newline stored here renders as
          // a space for the learner, so a paragraph break the author sees would
          // be one nobody else ever gets. Enter is therefore always structural:
          // whoever owns the list decides what comes next.
          if (event.key === "Enter") {
            event.preventDefault();
            onEnter?.();
            return;
          }

          // Backspace with nothing left to erase. Handed up rather than
          // swallowed: in a list it removes the item, in a paragraph it removes
          // the paragraph, and this field cannot tell which it is in.
          if (event.key === "Backspace" && onEmptyBackspace && (ref.current?.textContent ?? "") === "") {
            event.preventDefault();
            onEmptyBackspace();
          }
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

      {query !== null && anchor && matches.length > 0 && typeof document !== "undefined"
        ? createPortal(
            <div
              className={styles.slashList}
              role="listbox"
              aria-label="Команди"
              style={{ top: anchor.top, left: anchor.left, minWidth: anchor.width }}
            >
              {matches.map((command, index) => (
                <button
                  key={command.id}
                  className={styles.slashItem}
                  type="button"
                  role="option"
                  aria-selected={index === active}
                  data-active={index === active || undefined}
                  // The caret must not leave the field: losing it would close
                  // the menu before the click it is being closed by.
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => runCommand(command.id)}
                >
                  <span className={styles.slashLabel}>{command.label}</span>
                  {command.hint ? <span className={styles.slashHint}>{command.hint}</span> : null}
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
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
