import { describe, expect, it } from "vitest";

import { importIssueCopy } from "./importCopy";

describe("importIssueCopy", () => {
  it("names a course-level problem without an empty field path", () => {
    expect(importIssueCopy("lms_course_empty_modules:portable")).toBe(
      "Курс: Додайте масив modules з хоча б одним модулем, як у зразку JSON.",
    );
    expect(importIssueCopy("lms_course_title_too_long:portable.update")).not.toContain("Поле");
  });

  it("keeps the technical path for a nested problem", () => {
    expect(importIssueCopy("lms_block_empty_content:portable.modules[0].lessons[1].blocks[2]")).toBe(
      "Модуль 1, урок 2, блок 3: Додайте текст блоку. Поле: modules[0].lessons[1].blocks[2].",
    );
  });
});
