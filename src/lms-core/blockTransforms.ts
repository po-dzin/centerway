import type { LessonBlock, RichTextNode } from "./blocks";
import { inlineToPlainText, toSpans, type InlineText } from "./inline";

/** Join without flattening emphasis, links or internal references. */
export function joinInline(items: InlineText[], separator = "; "): InlineText {
  return items.flatMap((item, index) => [...(index ? [{ text: separator }] : []), ...toSpans(item)]);
}

export function changeNodeKind(content: RichTextNode[], index: number, kind: RichTextNode["kind"]): RichTextNode[] {
  const node = content[index];
  if (!node || node.kind === kind) return content;
  const items = node.kind === "ul" || node.kind === "ol" ? node.items : [node.text];
  return content.map((current, position) => position !== index ? current :
    kind === "ul" || kind === "ol" ? { kind, items } : { kind, text: joinInline(items) });
}

/** Replace just the addressed node; surrounding prose and its ordering survive. */
export function transformRichNode(
  block: Extract<LessonBlock, { type: "rich_text" }>,
  index: number,
  kind: "quote" | "code" | "checklist",
  ids: () => string,
): LessonBlock[] {
  const node = block.content[index];
  if (!node) return [block];
  const items = node.kind === "ul" || node.kind === "ol" ? node.items : [node.text];
  const before = block.content.slice(0, index);
  const after = block.content.slice(index + 1);
  const id = before.length ? ids() : block.id;
  const replacement: LessonBlock = kind === "quote"
    ? { id, type: kind, text: items.some((item) => inlineToPlainText(item).trim()) ? joinInline(items.filter((item) => inlineToPlainText(item).trim())) : "[ЗАПОВНИ: цитата]" }
    : kind === "code"
      ? { id, type: kind, code: items.map(inlineToPlainText).join("\n") || "[ЗАПОВНИ: код]" }
      : { id, type: kind, items: items.map((text) => ({ id: ids(), text: inlineToPlainText(text).trim() ? text : "[ЗАПОВНИ: пункт]" })) };
  return [
    ...(before.length ? [{ ...block, content: before }] : []),
    replacement,
    ...(after.length ? [{ ...block, id: ids(), content: after }] : []),
  ];
}
