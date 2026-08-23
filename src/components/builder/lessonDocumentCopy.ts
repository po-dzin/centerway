export function lessonDocumentFailureCopy(detail: string | undefined, fallback: string): string {
  const messages: Record<string, string> = {
    lms_lesson_document_unsupported_format: "Підтримуються лише Markdown (.md), Word (.docx) і текст (.txt).",
    lms_lesson_document_too_large: "Файл завеликий. Максимум — 5 МБ на урок.",
    lms_lesson_document_too_many_files: "В один урок можна імпортувати лише один файл за раз.",
    lms_lesson_document_empty: "У документі немає тексту, який можна перетворити на урок.",
    lms_lesson_document_invalid_docx: "Word-файл пошкоджений або має неочікувану структуру.",
    lms_lesson_document_invalid_utf8: "Текстовий файл має бути збережений у UTF-8.",
  };
  return (detail && messages[detail]) || fallback;
}
