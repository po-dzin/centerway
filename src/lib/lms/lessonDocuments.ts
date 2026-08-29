/**
 * Portable lesson documents for the Builder.
 *
 * Markdown is the semantic interchange format. Plain text is intentionally a
 * reduced view of it, while DOCX is converted to/from the same block contract.
 * No HTML enters the LMS model: every document becomes typed Lesson blocks.
 */

import {
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import mammoth from "mammoth";

import {
  assert,
  inlineToPlainText,
  isNonEmptyString,
  isRecord,
  slugify,
  uniqueSlug,
  validateInlineText,
  validateLessonBlock,
  type IdSource,
  type InlineSpan,
  type InlineText,
  type Lesson,
  type LessonBlock,
  type RichTextNode,
} from "@/lms-core";

export const LESSON_DOCUMENT_FORMATS = ["md", "docx", "txt"] as const;
export type LessonDocumentFormat = (typeof LESSON_DOCUMENT_FORMATS)[number];

const MIME_BY_FORMAT: Record<LessonDocumentFormat, string> = {
  md: "text/markdown; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

// Mammoth ships `convertToMarkdown` at runtime but its bundled declaration
// currently omits that one public method. Keep the compatibility shim local so
// no untyped document value crosses into the lesson model.
const mammothMarkdown = mammoth as typeof mammoth & {
  convertToMarkdown(
    input: { buffer: Buffer },
    options?: { convertImage?: typeof mammoth.images.dataUri },
  ): Promise<{ value: string; messages: Array<{ message: string }> }>;
};

const EMBEDDED_IMAGE_MARKER = "__CW_EMBEDDED_IMAGE_OMITTED__";

export type LessonDocument = {
  filename: string;
  mime: string;
  body: Uint8Array;
};

export function validatePortableLesson(input: unknown): asserts input is Lesson {
  assert(isRecord(input), "lms_lesson_document_invalid_shape");
  assert(isNonEmptyString(input.id), "lms_lesson_document_missing_id");
  assert(isNonEmptyString(input.slug), "lms_lesson_document_missing_slug");
  assert(isNonEmptyString(input.title), "lms_lesson_document_missing_title");
  assert(typeof input.order === "number" && Number.isInteger(input.order) && input.order > 0, "lms_lesson_document_invalid_order");
  if (input.summary !== undefined) {
    validateInlineText(input.summary, "lesson.summary");
  }
  if (input.durationMin !== undefined) {
    assert(typeof input.durationMin === "number" && input.durationMin > 0, "lms_lesson_document_invalid_duration");
  }
  assert(Array.isArray(input.blocks) && input.blocks.length > 0, "lms_lesson_document_empty");
  input.blocks.forEach((block, index) => validateLessonBlock(block, `lesson.blocks[${index}]`));
}

type ParsedUnit =
  | { kind: "rich"; node: RichTextNode }
  | { kind: "quote"; text: InlineText }
  | { kind: "code"; code: string; language?: string }
  | { kind: "checklist"; items: InlineText[] }
  | { kind: "image"; src: string; alt: string };

function extension(filename: string): string {
  return filename.toLowerCase().split(".").pop() ?? "";
}

export function lessonDocumentFormat(filename: string, mime = ""): LessonDocumentFormat | null {
  const ext = extension(filename);
  if (ext === "md" || ext === "markdown" || mime === "text/markdown") return "md";
  if (ext === "txt" || mime === "text/plain") return "txt";
  if (ext === "docx" || mime === MIME_BY_FORMAT.docx) return "docx";
  return null;
}

function filenameTitle(filename: string): string {
  const withoutExt = filename.replace(/\.[^.]+$/, "").trim();
  return withoutExt || "Новий урок";
}

function mergeSpan(spans: InlineSpan[], span: InlineSpan) {
  const previous = spans.at(-1);
  if (previous && previous.bold === span.bold && previous.italic === span.italic && previous.href === span.href) {
    previous.text += span.text;
  } else if (span.text) {
    spans.push(span);
  }
}

/** Basic Markdown inline syntax emitted by Word/Mammoth and by our exporter. */
function parseInline(source: string): InlineText {
  const spans: InlineSpan[] = [];
  const pattern = /(\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_)/g;
  let cursor = 0;
  for (const match of source.matchAll(pattern)) {
    const index = match.index ?? 0;
    mergeSpan(spans, { text: source.slice(cursor, index) });
    if (match[2] && match[3]) mergeSpan(spans, { text: match[2], href: match[3] });
    else if (match[4] || match[5]) mergeSpan(spans, { text: match[4] ?? match[5], bold: true });
    else mergeSpan(spans, { text: match[6] ?? match[7], italic: true });
    cursor = index + match[0].length;
  }
  mergeSpan(spans, { text: source.slice(cursor) });
  const cleaned = spans.filter((span) => span.text.trim().length > 0 || spans.length === 1);
  return cleaned.length === 1 && !cleaned[0].bold && !cleaned[0].italic && !cleaned[0].href
    ? cleaned[0].text.trim()
    : cleaned.map((span) => ({ ...span, text: span.text.replace(/\\([\\`*_{}\[\]()#+.!-])/g, "$1") }));
}

function isSpecial(line: string): boolean {
  return /^(#{1,6})\s+/.test(line)
    || /^```/.test(line)
    || /^>\s?/.test(line)
    || /^[-*+]\s+/.test(line)
    || /^\d+[.)]\s+/.test(line)
    || /^!\[[^\]]*\]\([^)]+\)\s*$/.test(line);
}

function parseMarkdown(source: string, fallbackTitle: string): { title: string; units: ParsedUnit[] } {
  const lines = source.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
  const units: ParsedUnit[] = [];
  let title = fallbackTitle;
  let cursor = 0;
  let titleTaken = false;

  while (cursor < lines.length) {
    const raw = lines[cursor];
    const line = raw.trim();
    if (!line || /^<!--.*-->$/.test(line) || /^---+$/.test(line)) {
      cursor += 1;
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      if (heading[1].length === 1 && !titleTaken) {
        title = inlineToPlainText(parseInline(heading[2]));
        titleTaken = true;
      } else {
        units.push({ kind: "rich", node: { kind: "h3", text: parseInline(heading[2]) } });
      }
      cursor += 1;
      continue;
    }

    const image = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)\s*$/.exec(line);
    if (image) {
      units.push({ kind: "image", alt: image[1].trim() || "Зображення уроку", src: image[2] });
      cursor += 1;
      continue;
    }

    const fence = /^```([^\s`]*)\s*$/.exec(line);
    if (fence) {
      const code: string[] = [];
      cursor += 1;
      while (cursor < lines.length && !/^```\s*$/.test(lines[cursor].trim())) code.push(lines[cursor++]);
      if (cursor < lines.length) cursor += 1;
      if (code.join("\n").trim()) units.push({ kind: "code", code: code.join("\n"), language: fence[1] || undefined });
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (cursor < lines.length && /^>\s?/.test(lines[cursor].trim())) {
        quote.push(lines[cursor].trim().replace(/^>\s?/, ""));
        cursor += 1;
      }
      units.push({ kind: "quote", text: parseInline(quote.join(" ")) });
      continue;
    }

    if (/^[-*+]\s+/.test(line)) {
      const items: InlineText[] = [];
      let checklist = false;
      while (cursor < lines.length && /^[-*+]\s+/.test(lines[cursor].trim())) {
        const item = lines[cursor].trim().replace(/^[-*+]\s+/, "");
        checklist ||= /^\[[ xX]\]\s+/.test(item);
        items.push(parseInline(item.replace(/^\[[ xX]\]\s+/, "")));
        cursor += 1;
      }
      units.push(checklist ? { kind: "checklist", items } : { kind: "rich", node: { kind: "ul", items } });
      continue;
    }

    if (/^\d+[.)]\s+/.test(line)) {
      const items: InlineText[] = [];
      while (cursor < lines.length && /^\d+[.)]\s+/.test(lines[cursor].trim())) {
        items.push(parseInline(lines[cursor].trim().replace(/^\d+[.)]\s+/, "")));
        cursor += 1;
      }
      units.push({ kind: "rich", node: { kind: "ol", items } });
      continue;
    }

    const paragraph = [line];
    cursor += 1;
    while (cursor < lines.length && lines[cursor].trim() && !isSpecial(lines[cursor].trim())) {
      paragraph.push(lines[cursor].trim());
      cursor += 1;
    }
    units.push({ kind: "rich", node: { kind: "p", text: parseInline(paragraph.join(" ")) } });
  }

  return { title: title.trim() || fallbackTitle, units };
}

function unitsToBlocks(units: ParsedUnit[], ids: IdSource): LessonBlock[] {
  const blocks: LessonBlock[] = [];
  let rich: RichTextNode[] = [];
  const flush = () => {
    if (!rich.length) return;
    blocks.push({ id: ids(), type: "rich_text", content: rich });
    rich = [];
  };

  for (const unit of units) {
    if (unit.kind === "rich") {
      rich.push(unit.node);
      continue;
    }
    flush();
    if (unit.kind === "quote") blocks.push({ id: ids(), type: "quote", text: unit.text });
    if (unit.kind === "code") blocks.push({ id: ids(), type: "code", code: unit.code, language: unit.language });
    if (unit.kind === "checklist") {
      blocks.push({ id: ids(), type: "checklist", items: unit.items.map((text) => ({ id: ids(), text })) });
    }
    if (unit.kind === "image") blocks.push({ id: ids(), type: "image", src: unit.src, alt: unit.alt });
  }
  flush();
  return blocks;
}

export async function importLessonDocument(
  input: { filename: string; mime?: string; bytes: Uint8Array },
  options: { ids: IdSource; takenSlugs: Iterable<string>; order: number; dayIndex?: number },
): Promise<Lesson> {
  const format = lessonDocumentFormat(input.filename, input.mime);
  if (!format) throw new Error("lms_lesson_document_unsupported_format");

  let markdown: string;
  if (format === "docx") {
    try {
      const result = await mammothMarkdown.convertToMarkdown(
        { buffer: Buffer.from(input.bytes) },
        {
          // A Word file is a lesson transfer, not a media archive. Do not put
          // multi-megabyte data URIs into the course JSON; leave an explicit
          // editorial note where the image was so it cannot disappear silently.
          convertImage: mammoth.images.imgElement(async () => ({ src: EMBEDDED_IMAGE_MARKER })),
        },
      );
      markdown = result.value.replace(
        new RegExp(`!\\[[^\\]]*\\]\\(${EMBEDDED_IMAGE_MARKER}\\)`, "g"),
        "> Вбудоване зображення пропущено — додайте його через медіа-поле Builder.",
      );
    } catch {
      throw new Error("lms_lesson_document_invalid_docx");
    }
  } else {
    try {
      markdown = new TextDecoder("utf-8", { fatal: true }).decode(input.bytes);
    } catch {
      throw new Error("lms_lesson_document_invalid_utf8");
    }
    if (format === "txt") {
      markdown = markdown
        .replace(/\r\n?/g, "\n")
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.replace(/\n+/g, " ").trim())
        .filter(Boolean)
        .join("\n\n");
    }
  }

  const parsed = parseMarkdown(markdown, filenameTitle(input.filename));
  const blocks = unitsToBlocks(parsed.units, options.ids);
  if (!blocks.length) throw new Error("lms_lesson_document_empty");
  blocks.forEach((block, index) => validateLessonBlock(block, `lesson.blocks[${index}]`));

  return {
    id: options.ids(),
    slug: uniqueSlug(parsed.title, options.takenSlugs),
    title: parsed.title,
    order: options.order,
    dayIndex: options.dayIndex,
    blocks,
  };
}

function markdownInline(value: InlineText): string {
  if (typeof value === "string") return value;
  return value.map((span) => {
    let text = span.text;
    if (span.bold) text = `**${text}**`;
    if (span.italic) text = `*${text}*`;
    if (span.href) text = `[${text}](${span.href})`;
    return text;
  }).join("");
}

export function lessonToMarkdown(lesson: Lesson): string {
  const out: string[] = [`# ${lesson.title}`];
  if (lesson.summary) out.push("", `<!-- centerway:summary ${JSON.stringify(inlineToPlainText(lesson.summary))} -->`);
  if (lesson.durationMin) out.push(`<!-- centerway:duration-min ${lesson.durationMin} -->`);

  for (const block of lesson.blocks) {
    out.push("");
    switch (block.type) {
      case "lesson_objective": out.push("## Мета уроку", "", markdownInline(block.text)); break;
      case "rich_text":
        for (const node of block.content) {
          if (node.kind === "p") out.push(markdownInline(node.text), "");
          if (node.kind === "h3") out.push(`### ${markdownInline(node.text)}`, "");
          if (node.kind === "ul") out.push(...node.items.map((item) => `- ${markdownInline(item)}`), "");
          if (node.kind === "ol") out.push(...node.items.map((item, index) => `${index + 1}. ${markdownInline(item)}`), "");
        }
        break;
      case "protocol_step": out.push(`## Крок ${block.step}: ${markdownInline(block.title)}`, "", ...(block.timing ? [`*${block.timing}*`, ""] : []), ...(block.text ? [markdownInline(block.text)] : [])); break;
      case "practice_block": out.push(`## Практика: ${markdownInline(block.title)}`, "", ...(block.text ? [markdownInline(block.text), ""] : []), ...(block.durationMin ? [`Тривалість: ${block.durationMin} хв.`] : [])); break;
      case "checklist": out.push(...block.items.map((item) => `- [ ] ${markdownInline(item.text)}`)); break;
      case "video": out.push(`## Відео${block.title ? `: ${markdownInline(block.title)}` : ""}`, "", `https://youtu.be/${block.videoId}`); break;
      case "image": out.push(`![${block.alt}](${block.src})`, ...(block.caption ? ["", markdownInline(block.caption)] : [])); break;
      case "quote": out.push(...markdownInline(block.text).split("\n").map((line) => `> ${line}`), ...(block.author ? [`> — ${block.author}`] : [])); break;
      case "code": out.push(`\`\`\`${block.language ?? ""}`, block.code, "\`\`\`"); break;
      case "boundary_note": out.push("## Межі й застереження", "", markdownInline(block.text)); break;
      case "faq_block": block.items.forEach((item) => out.push(`### ${markdownInline(item.question)}`, "", markdownInline(item.answer), "")); break;
      case "table":
        if (block.title) out.push(`### ${markdownInline(block.title)}`, "");
        {
          const head = block.head ?? block.rows[0].map((_, index) => `Колонка ${index + 1}`);
          out.push(`| ${head.map(markdownInline).join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`);
          out.push(...block.rows.map((row) => `| ${row.map(markdownInline).join(" | ")} |`));
        }
        break;
      case "cta": out.push(`## ${block.label}`, ...(block.text ? ["", markdownInline(block.text)] : []), "", `[Перейти](${block.href})`); break;
    }
  }
  return `${out.join("\n").replace(/\n{3,}/g, "\n\n").trim()}\n`;
}

export function lessonToText(lesson: Lesson): string {
  return lessonToMarkdown(lesson)
    .replace(/^<!--.*-->\n?/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^```[^\n]*\n?/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^[-*+] \[[ xX]\]\s+/gm, "• ")
    .replace(/^[-*+]\s+/gm, "• ")
    .replace(/^\d+[.)]\s+/gm, "")
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, "$1 — $2")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 — $2")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim() + "\n";
}

function textRuns(value: InlineText): TextRun[] {
  const spans = typeof value === "string" ? [{ text: value }] : value;
  return spans.map((span) => new TextRun({ text: span.text, bold: span.bold, italics: span.italic }));
}

function lessonDocxParagraphs(lesson: Lesson): Paragraph[] {
  const paragraphs: Paragraph[] = [new Paragraph({ text: lesson.title, heading: HeadingLevel.HEADING_1 })];
  if (lesson.summary) paragraphs.push(new Paragraph({ children: textRuns(lesson.summary), style: "Subtitle" }));

  const heading = (text: string) => paragraphs.push(new Paragraph({ text, heading: HeadingLevel.HEADING_2 }));
  for (const block of lesson.blocks) {
    switch (block.type) {
      case "lesson_objective": heading("Мета уроку"); paragraphs.push(new Paragraph({ children: textRuns(block.text) })); break;
      case "rich_text":
        block.content.forEach((node) => {
          if (node.kind === "p") paragraphs.push(new Paragraph({ children: textRuns(node.text) }));
          if (node.kind === "h3") paragraphs.push(new Paragraph({ children: textRuns(node.text), heading: HeadingLevel.HEADING_3 }));
          if (node.kind === "ul" || node.kind === "ol") {
            node.items.forEach((item) => paragraphs.push(new Paragraph({
              children: textRuns(item),
              numbering: { reference: node.kind === "ul" ? "bullets" : "numbers", level: 0 },
            })));
          }
        });
        break;
      case "protocol_step": heading(`Крок ${block.step}: ${inlineToPlainText(block.title)}`); if (block.timing) paragraphs.push(new Paragraph({ children: [new TextRun({ text: block.timing, italics: true })] })); if (block.text) paragraphs.push(new Paragraph({ children: textRuns(block.text) })); break;
      case "practice_block": heading(`Практика: ${inlineToPlainText(block.title)}`); if (block.text) paragraphs.push(new Paragraph({ children: textRuns(block.text) })); if (block.durationMin) paragraphs.push(new Paragraph({ text: `Тривалість: ${block.durationMin} хв.` })); break;
      case "checklist":
        block.items.forEach((item) => paragraphs.push(new Paragraph({
          children: [new TextRun("☐ "), ...textRuns(item.text)],
        })));
        break;
      case "video": heading(block.title ? `Відео: ${inlineToPlainText(block.title)}` : "Відео"); paragraphs.push(new Paragraph({ text: `https://youtu.be/${block.videoId}` })); break;
      case "image": paragraphs.push(new Paragraph({ text: `${block.alt}: ${block.src}` })); if (block.caption) paragraphs.push(new Paragraph({ children: textRuns(block.caption) })); break;
      case "quote": paragraphs.push(new Paragraph({ children: [...textRuns(block.text), ...(block.author ? [new TextRun({ text: ` — ${block.author}`, italics: true })] : [])], indent: { left: 720 } })); break;
      case "code": paragraphs.push(new Paragraph({ children: [new TextRun({ text: block.code, font: "Courier New" })], style: "Normal" })); break;
      case "boundary_note": heading("Межі й застереження"); paragraphs.push(new Paragraph({ children: textRuns(block.text) })); break;
      case "faq_block": block.items.forEach((item) => { paragraphs.push(new Paragraph({ children: textRuns(item.question), heading: HeadingLevel.HEADING_3 })); paragraphs.push(new Paragraph({ children: textRuns(item.answer) })); }); break;
      case "table": if (block.title) paragraphs.push(new Paragraph({ children: textRuns(block.title), heading: HeadingLevel.HEADING_3 })); [...(block.head ? [block.head] : []), ...block.rows].forEach((row) => paragraphs.push(new Paragraph({ text: row.map(inlineToPlainText).join(" | ") }))); break;
      case "cta": heading(block.label); if (block.text) paragraphs.push(new Paragraph({ children: textRuns(block.text) })); paragraphs.push(new Paragraph({ text: block.href })); break;
    }
  }
  return paragraphs;
}

export async function exportLessonDocument(lesson: Lesson, format: LessonDocumentFormat): Promise<LessonDocument> {
  const base = slugify(lesson.title || lesson.slug);
  if (format === "md" || format === "txt") {
    const text = format === "md" ? lessonToMarkdown(lesson) : lessonToText(lesson);
    return { filename: `${base}.${format}`, mime: MIME_BY_FORMAT[format], body: new TextEncoder().encode(text) };
  }

  const document = new Document({
    numbering: {
      config: [
        { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: "left", style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
        { reference: "numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: "left", style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      ],
    },
    sections: [{ properties: {}, children: lessonDocxParagraphs(lesson) }],
  });
  return { filename: `${base}.docx`, mime: MIME_BY_FORMAT.docx, body: await Packer.toBuffer(document) };
}
