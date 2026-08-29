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
 * THE TOOLBAR FLOATS AND IS PORTALLED. It used to be a row that appeared above
 * the field on focus — which pushed the block down the page the moment the
 * caret entered it, and pushed it back on the way out. A control that moves the
 * thing it acts on is worse than no control. It now hangs over the selection in
 * a fixed layer, so nothing in the document moves, and the right mouse button
 * opens the same panel: formatting is what a context menu on prose is FOR.
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

import { Icon } from "@/components/Icon";
import { BuilderMenu } from "./BuilderMenu";
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
  /** A short semantic shelf in the menu, such as “Текст” or “Блоки”. */
  group?: string;
};

export type InternalReferenceOption = {
  /** Stable `cw-ref:*` identity, never a route assembled from a mutable slug. */
  key: string;
  label: string;
  hint: string;
  group: string;
  future?: boolean;
};

function trailingMentionRange(root: HTMLElement): { query: string; range: Range } | null {
  const selection = window.getSelection();
  if (!selection || !selection.isCollapsed || selection.rangeCount === 0) return null;
  const caret = selection.getRangeAt(0);
  if (!root.contains(caret.endContainer)) return null;

  const before = document.createRange();
  before.selectNodeContents(root);
  before.setEnd(caret.endContainer, caret.endOffset);
  const text = before.toString();
  const match = /(?:^|\s)@([^\s@]*)$/.exec(text);
  if (!match) return null;

  const atOffset = text.length - match[0].length + (match[0].startsWith("@") ? 0 : 1);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let consumed = 0;
  let node = walker.nextNode();
  while (node) {
    const length = node.textContent?.length ?? 0;
    if (atOffset <= consumed + length) {
      const range = document.createRange();
      range.setStart(node, Math.max(0, atOffset - consumed));
      range.setEnd(caret.endContainer, caret.endOffset);
      return { query: match[1], range };
    }
    consumed += length;
    node = walker.nextNode();
  }
  return null;
}

export function BuilderInlineEditor({
  value,
  multiline,
  label,
  placeholder,
  autoFocus,
  bare,
  phrasing,
  commands,
  references,
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
  /**
   * Renders as spans instead of divs.
   *
   * The field is placed INSIDE the block's own rendering when a block is being
   * authored — inside a `<p>`, an `<h3>`, a `<summary>`. A `<div>` is not
   * allowed there, and the browser silently reparents it, which in a hydrating
   * app is not a nicety about markup: the server's tree and the client's stop
   * matching and React throws the whole subtree away.
   */
  phrasing?: boolean;
  /** Offered when the author types "/" into an empty field. */
  commands?: SlashCommand[];
  /** Internal course entities offered by the separate `@` command. */
  references?: InternalReferenceOption[];
  onChange: (next: InlineText | undefined) => void;
  onCommand?: (id: string) => void;
  /** Enter. The span model has no line break, so this is always a structural move. */
  onEnter?: () => void;
  /** Backspace with nothing left to delete — "join me to what came before". */
  onEmptyBackspace?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const Box = (phrasing ? "span" : "div") as "div";
  const [focused, setFocused] = useState(false);
  const [asText, setAsText] = useState(false);
  const [linkDraft, setLinkDraft] = useState<string | null>(null);
  /** Whether the surface currently holds anything — what decides the placeholder. */
  const [hasText, setHasText] = useState(false);
  /**
   * Where the formatting panel hangs, in viewport coordinates, or null when it
   * is shut. `flip` is set when the selection is too near the top of the window
   * for the panel to sit above it.
   */
  const [bar, setBar] = useState<{ x: number; y: number; flip: boolean } | null>(null);
  /** Opened by the right button, and then it stays until dismissed. */
  const [pinned, setPinned] = useState(false);
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
  const [referenceQuery, setReferenceQuery] = useState<string | null>(null);
  const referenceRange = useRef<Range | null>(null);
  const [cursor, setCursor] = useState(0);
  const [anchor, setAnchor] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
    flip: boolean;
  } | null>(null);

  const matches = (commands ?? []).filter(
    (command) => query !== null && command.label.toLowerCase().includes(query.toLowerCase())
  );
  const referenceMatches = (references ?? []).filter((option) => {
    if (referenceQuery === null) return false;
    const haystack = `${option.label} ${option.hint}`.toLocaleLowerCase("uk");
    return haystack.includes(referenceQuery.toLocaleLowerCase("uk"));
  });
  const menuMatches = referenceQuery !== null ? referenceMatches : matches;
  // Clamped rather than reset: narrowing the query must not silently move the
  // highlight back to the top under an author who is about to press Enter.
  const active = menuMatches.length > 0 ? Math.min(cursor, menuMatches.length - 1) : 0;
  const groupedMatches = matches.reduce<Array<{ label: string; commands: SlashCommand[] }>>((groups, command) => {
    const label = command.group ?? "Команди";
    const current = groups.at(-1);
    if (current?.label === label) current.commands.push(command);
    else groups.push({ label, commands: [command] });
    return groups;
  }, []);

  /**
   * Puts the panel over the current selection.
   *
   * The anchor is a POINT, not a box, and the panel is centred on it with a
   * transform — which is what lets it be positioned in one pass. Measuring the
   * panel first would mean rendering it invisibly for a frame, and a formatting
   * bar that blinks is exactly the twitchiness this replaced.
   */
  const placeBar = useCallback((from?: { x: number; y: number }) => {
    const element = ref.current;
    if (!element) return;

    let point = from;
    if (!point) {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        setBar(null);
        return;
      }
      const range = selection.getRangeAt(0);
      if (!element.contains(range.commonAncestorContainer)) {
        setBar(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      // A collapsed caret reports a zero-width rect, which is still a position.
      const box = rect.width === 0 && rect.height === 0 ? element.getBoundingClientRect() : rect;
      point = { x: box.left + box.width / 2, y: box.top };
    }

    setBar({
      // Clamped so the panel cannot hang off the side of the window. The number
      // is half a plausible panel, which is cheaper than measuring and wrong by
      // at most a few pixels on a selection made at the very edge.
      x: Math.min(Math.max(point.x, 110), window.innerWidth - 110),
      y: point.y,
      flip: point.y < 72,
    });
  }, []);

  const closeMenu = useCallback(() => {
    setQuery(null);
    setReferenceQuery(null);
    referenceRange.current = null;
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
    if (query === null && referenceQuery === null) return;
    const element = ref.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const gutter = 12;
    const preferredWidth = Math.min(352, window.innerWidth - 2 * gutter);
    const roomBelow = window.innerHeight - rect.bottom - gutter;
    const roomAbove = rect.top - gutter;
    const flip = roomBelow < 280 && roomAbove > roomBelow;
    setAnchor({
      top: flip ? rect.top - 6 : rect.bottom + 6,
      left: Math.min(Math.max(rect.left, gutter), window.innerWidth - preferredWidth - gutter),
      width: preferredWidth,
      maxHeight: Math.max(160, Math.min(408, flip ? roomAbove : roomBelow)),
      flip,
    });
  }, [query, referenceQuery]);

  /**
   * The panel follows the selection while the caret is in this field.
   *
   * Bound only while focused: `selectionchange` fires on every caret move in
   * the document, and a lesson holds dozens of these fields at once.
   */
  useEffect(() => {
    if (!focused) return;
    const onSelectionChange = () => {
      if (pinned) return;
      const selection = window.getSelection();
      const element = ref.current;
      if (!selection || selection.isCollapsed || !element || selection.rangeCount === 0) {
        setBar(null);
        return;
      }
      if (!element.contains(selection.getRangeAt(0).commonAncestorContainer)) {
        setBar(null);
        return;
      }
      placeBar();
    };
    document.addEventListener("selectionchange", onSelectionChange);
    return () => document.removeEventListener("selectionchange", onSelectionChange);
  }, [focused, pinned, placeBar]);

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
    const incoming = inlineToPlainText(value ?? "").includes(PLACEHOLDER_MARKER) ? undefined : value;
    const html = inlineToHtml(incoming ?? "");
    if (element.innerHTML !== html) element.innerHTML = html;
    setHasText((element.textContent ?? "") !== "");
  }, [value, asText]);

  const emitFromElement = useCallback((element: HTMLElement) => {
    const next = nodesToInline(readNodes(element));
    onChange(next === "" ? undefined : next);
  }, [onChange]);

  const runReference = useCallback((option: InternalReferenceOption) => {
    const element = ref.current;
    const range = referenceRange.current;
    if (!element || !range) return;

    const link = document.createElement("a");
    link.setAttribute("href", option.key);
    link.textContent = option.label;
    const space = document.createTextNode(" ");
    range.deleteContents();
    range.insertNode(link);
    link.after(space);

    const caret = document.createRange();
    caret.setStartAfter(space);
    caret.collapse(true);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(caret);
    closeMenu();
    emitFromElement(element);
  }, [closeMenu, emitFromElement]);

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
      setReferenceQuery(null);
      referenceRange.current = null;
      setCursor(0);
      // Deliberately NOT written to the model: a half-typed command is not
      // content, and recording it would put "/" on the undo stack and, if the
      // author walked away mid-command, into the saved course.
      return;
    }

    setQuery(null);
    const mention = references && references.length > 0 ? trailingMentionRange(element) : null;
    if (mention) {
      referenceRange.current = mention.range;
      setReferenceQuery(mention.query);
      setCursor(0);
    } else {
      setReferenceQuery(null);
      referenceRange.current = null;
      setAnchor(null);
    }
    emitFromElement(element);
  }, [commands, emitFromElement, references]);

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
  const editableValue = hasMarker ? undefined : value;

  if (asText) {
    return (
      <Box className={styles.inlineField}>
        <Box className={styles.inlineBar}>
          <span className={styles.inlineHint}>
            <code>**жирне**</code> · <code>*курсив*</code> · <code>[текст](посилання)</code>
          </span>
          <button className={styles.inlineToggle} type="button" onClick={() => setAsText(false)}>
            Кнопками
          </button>
        </Box>
        <textarea
          className={`${styles.textarea} ${hasMarker ? styles.inputTodo : ""}`}
          aria-label={label}
          rows={multiline ? 3 : 2}
          value={inlineToMarkup(editableValue ?? "")}
          placeholder={placeholder}
          onChange={(event) => {
            const next = markupToInline(event.target.value);
            onChange(next === "" ? undefined : next);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
        />
      </Box>
    );
  }

  const closeBar = () => {
    setPinned(false);
    setBar(null);
    setLinkDraft(null);
  };

  return (
    <Box className={styles.inlineField}>
      <Box
        ref={ref}
        className={`${bare ? styles.inlineBare : styles.inlineSurface} ${hasMarker ? styles.inputTodo : ""} ${phrasing ? styles.inlinePhrasing : ""}`}
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
          closeMenu();
          // The panel's own buttons keep the caret (they preventDefault on
          // mousedown), so a blur that reaches here means the author went
          // somewhere else and the panel has nothing left to act on.
          closeBar();
        }}
        onContextMenu={(event) => {
          // The right button on prose should offer formatting. It is the one
          // gesture that already means "what can I do with this", and the
          // browser's own menu over a contenteditable offers spell-check and
          // little else that applies here.
          event.preventDefault();
          setPinned(true);
          placeBar({ x: event.clientX, y: event.clientY });
        }}
        onInput={emit}
        onKeyDown={(event) => {
          if (referenceQuery !== null && referenceMatches.length > 0) {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setCursor((active + 1) % referenceMatches.length);
              return;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setCursor((active - 1 + referenceMatches.length) % referenceMatches.length);
              return;
            }
            if (event.key === "Enter" || event.key === "Tab") {
              event.preventDefault();
              runReference(referenceMatches[active]);
              return;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              closeMenu();
              return;
            }
          }

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

          if (event.key === "Escape" && bar) {
            event.preventDefault();
            closeBar();
            return;
          }

          // The span model has NO line break. A newline stored here renders as
          // a space for the learner, so a paragraph break the author sees would
          // be one nobody else ever gets. Enter is therefore always structural:
          // whoever owns the list decides what comes next.
          if (event.key === "Enter") {
            event.preventDefault();
            if (onEnter) onEnter();
            else ref.current?.blur();
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

      {bar && typeof document !== "undefined"
        ? createPortal(
            <div
              className={styles.formatBar}
              data-flip={bar.flip || undefined}
              style={{ left: bar.x, top: bar.y }}
              role="toolbar"
              aria-label={`Форматування: ${label}`}
              // Every control here keeps the caret where it is. Losing the
              // selection to a button press would apply the command to nothing.
              onMouseDown={(event) => event.preventDefault()}
            >
              {linkDraft !== null ? (
                <>
                  <input
                    className={styles.formatInput}
                    type="text"
                    autoFocus
                    placeholder="/programs/way21 або https://…"
                    aria-label="Адреса посилання"
                    value={linkDraft}
                    onChange={(event) => setLinkDraft(event.target.value)}
                    onMouseDown={(event) => event.stopPropagation()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        applyLink();
                      }
                      if (event.key === "Escape") closeBar();
                    }}
                  />
                  <button className={styles.formatAction} type="button" onClick={applyLink}>
                    Додати
                  </button>
                </>
              ) : (
                <>
                  {/* FOUR GROUPS, IN THE ORDER A HAND MOVES ACROSS THEM: what
                      the selected characters look like, then where they point,
                      then what surrounds them as a paragraph, then how the
                      whole field is edited. A divider marks each seam so the
                      icon-only row still reads as sentences rather than a
                      single undifferentiated strip. */}
                  <button className={styles.formatIconAction} type="button" title="Жирний" aria-label="Жирний" onClick={() => exec("bold")}>
                    <Icon name="bold" size={18} />
                  </button>
                  <button className={styles.formatIconAction} type="button" title="Курсив" aria-label="Курсив" onClick={() => exec("italic")}>
                    <Icon name="italic" size={18} />
                  </button>
                  <button
                    className={styles.formatIconAction}
                    type="button"
                    title="Посилання"
                    aria-label="Посилання"
                    onClick={() => {
                      const element = ref.current;
                      if (!element) return;
                      if (enclosingLink(element)) {
                        exec("unlink");
                        return;
                      }
                      // The selection is lost the moment focus moves to the
                      // input, so the range is kept and restored on apply.
                      const selection = window.getSelection();
                      savedRange.current =
                        selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;
                      setLinkDraft("");
                    }}
                  >
                    <Icon name="link" size={18} />
                  </button>
                  {/* PARAGRAPH SHAPE AND «AS TEXT», BEHIND ONE OVERFLOW BELOW
                      901PX. Seven icon buttons plus three dividers do not fit
                      the phone width this bar already clamps to
                      (`max-width: calc(100vw - 1rem)`) without the strip
                      itself scrolling sideways — a toolbar that scrolls out
                      from under the thumb that opened it. Список / Нумерований
                      список / Цитата / Код / Як текст move into one menu,
                      because they are the four things this bar does to a
                      PARAGRAPH rather than to the selected characters, plus
                      the escape hatch — losing none of them, just asking for
                      them by name instead of by row. */}
                  <span className={styles.formatWideOnly}>
                    {onCommand && commands?.some((command) => command.id === "ul") ? (
                      <>
                        <span className={styles.formatDivider} aria-hidden="true" />
                        <button className={styles.formatIconAction} type="button" title="Список" aria-label="Список" onClick={() => { onCommand("ul"); closeBar(); }}>
                          <Icon name="list" size={18} />
                        </button>
                        <button className={styles.formatIconAction} type="button" title="Нумерований список" aria-label="Нумерований список" onClick={() => { onCommand("ol"); closeBar(); }}>
                          <Icon name="list-ordered" size={18} />
                        </button>
                        <span className={styles.formatDivider} aria-hidden="true" />
                        <button className={styles.formatIconAction} type="button" title="Цитата" aria-label="Цитата" onClick={() => { onCommand("block:quote"); closeBar(); }}>
                          <Icon name="quote" size={18} />
                        </button>
                        <button className={styles.formatIconAction} type="button" title="Код" aria-label="Код" onClick={() => { onCommand("block:code"); closeBar(); }}>
                          <Icon name="code" size={18} />
                        </button>
                      </>
                    ) : null}
                    <span className={styles.formatDivider} aria-hidden="true" />
                    <button
                      className={styles.formatIconAction}
                      type="button"
                      title="Правити як розмітку"
                      aria-label="Правити як розмітку"
                      onClick={() => {
                        closeBar();
                        setAsText(true);
                      }}
                    >
                      <Icon name="edit" size={18} />
                    </button>
                  </span>
                  <span className={styles.formatNarrowOnly}>
                    <span className={styles.formatDivider} aria-hidden="true" />
                    <BuilderMenu
                      label="Ще форматування"
                      contextArea={false}
                      items={[
                        ...(onCommand && commands?.some((command) => command.id === "ul")
                          ? [
                              { label: "Список", icon: "list" as const, onSelect: () => { onCommand("ul"); closeBar(); } },
                              { label: "Нумерований список", icon: "list-ordered" as const, onSelect: () => { onCommand("ol"); closeBar(); } },
                              { label: "Цитата", icon: "quote" as const, onSelect: () => { onCommand("block:quote"); closeBar(); } },
                              { label: "Код", icon: "code" as const, onSelect: () => { onCommand("block:code"); closeBar(); } },
                            ]
                          : []),
                        {
                          label: "Правити як розмітку",
                          icon: "edit" as const,
                          onSelect: () => {
                            closeBar();
                            setAsText(true);
                          },
                        },
                      ]}
                    />
                  </span>
                </>
              )}
            </div>,
            document.body
          )
        : null}

      {query !== null && anchor && matches.length > 0 && typeof document !== "undefined"
        ? createPortal(
            <div
              className={styles.slashList}
              role="listbox"
              aria-label="Команди"
              data-flip={anchor.flip || undefined}
              style={{
                top: anchor.top,
                left: anchor.left,
                width: anchor.width,
                maxHeight: anchor.maxHeight,
              }}
            >
              {groupedMatches.map((group) => (
                <div className={styles.slashGroup} role="group" aria-label={group.label} key={group.label}>
                  <div className={styles.slashGroupTitle} aria-hidden="true">{group.label}</div>
                  {group.commands.map((command) => {
                    const index = matches.indexOf(command);
                    return (
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
                    );
                  })}
                </div>
              ))}
            </div>,
            document.body
          )
        : null}

      {referenceQuery !== null && anchor && referenceMatches.length > 0 && typeof document !== "undefined"
        ? createPortal(
            <div
              className={styles.slashList}
              role="listbox"
              aria-label="Внутрішні посилання"
              data-flip={anchor.flip || undefined}
              style={{ top: anchor.top, left: anchor.left, width: anchor.width, maxHeight: anchor.maxHeight }}
            >
              {references?.map((option) => option.group).filter((group, index, groups) => groups.indexOf(group) === index).map((group) => {
                const options = referenceMatches.filter((option) => option.group === group);
                if (options.length === 0) return null;
                return (
                  <div className={styles.slashGroup} role="group" aria-label={group} key={group}>
                    <div className={styles.slashGroupTitle} aria-hidden="true">{group}</div>
                    {options.map((option) => {
                      const index = referenceMatches.indexOf(option);
                      return (
                        <button
                          key={option.key}
                          className={styles.slashItem}
                          type="button"
                          role="option"
                          aria-selected={index === active}
                          data-active={index === active || undefined}
                          onMouseDown={(event) => event.preventDefault()}
                          onMouseEnter={() => setCursor(index)}
                          onClick={() => runReference(option)}
                        >
                          <span className={styles.slashLabel}>{option.label}</span>
                          <span className={styles.slashHint}>{option.future ? "Майбутній урок · " : ""}{option.hint}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>,
            document.body
          )
        : null}
    </Box>
  );

  function applyLink() {
    const href = (linkDraft ?? "").trim();
    closeBar();
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
