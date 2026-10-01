import { describe, expect, it } from "vitest";

import { parseBlocks, renderBroadcast, resolvePlaceholders } from "./render";

const content = {
  subject: "{{first_name|Друже}}, старт 1 листопада",
  preheader: "Групова програма",
  body: "Вітаю, {{first_name|друже}}!\n\n# Що буде\n\n- 21 день\n- **група**\n\nДеталі [тут](https://www.centerway.net.ua/programs).",
  ctaLabel: "Записатися",
  ctaUrl: "https://www.centerway.net.ua/programs/way21",
};

describe("renderBroadcast", () => {
  it("fills the name, with the fallback when there is none", () => {
    expect(renderBroadcast(content, { name: "Олена Коваль" }, "https://u").subject).toBe("Олена, старт 1 листопада");
    expect(renderBroadcast(content, { name: null }, "https://u").subject).toBe("Друже, старт 1 листопада");
    expect(resolvePlaceholders("{{name}}", "  ")).toBe("");
  });

  it("turns the small markup into HTML and plain text", () => {
    const out = renderBroadcast(content, { name: "Олена" }, "https://u");
    expect(out.html).toContain("<h2");
    expect(out.html).toContain('<li style="margin:0 0 6px">21 день</li>');
    expect(out.html).toContain("<strong>група</strong>");
    expect(out.html).toContain('<a href="https://www.centerway.net.ua/programs"');
    expect(out.text).toContain("ЩО БУДЕ");
    expect(out.text).toContain("— 21 день");
    expect(out.text).toContain("тут (https://www.centerway.net.ua/programs)");
    expect(out.text).toContain("Записатися: https://www.centerway.net.ua/programs/way21");
  });

  it("escapes what was typed, and prints a name instead of interpreting it", () => {
    const out = renderBroadcast(
      { ...content, body: "<script>x</script> {{name}}" },
      { name: "**Bob** [x](https://evil.example)" },
      "https://u",
    );
    expect(out.html).not.toContain("<script>");
    expect(out.html).toContain("&lt;script&gt;");
    expect(out.html).not.toContain("<strong>Bob</strong>");
    expect(out.html).not.toContain('href="https://evil.example"');
  });

  it("refuses a link or a button that is not http(s)", () => {
    const out = renderBroadcast(
      { ...content, body: "[x](javascript:alert(1))", ctaUrl: "javascript:alert(1)" },
      { name: null },
      "https://u",
    );
    expect(out.html).not.toContain(`href="javascript`);
    expect(out.html).not.toContain("Записатися");
  });

  it("always carries the way out, in the body and in the headers", () => {
    const out = renderBroadcast(content, { name: null }, "https://www.centerway.net.ua/api/unsubscribe?t=abc");
    expect(out.html).toContain('href="https://www.centerway.net.ua/api/unsubscribe?t=abc"');
    expect(out.text).toContain("https://www.centerway.net.ua/api/unsubscribe?t=abc");
    expect(out.headers["List-Unsubscribe"]).toBe("<https://www.centerway.net.ua/api/unsubscribe?t=abc>");
    expect(out.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });
});

describe("parseBlocks", () => {
  it("keeps single newlines inside a paragraph and splits on blank lines", () => {
    expect(parseBlocks("a\nb\n\n\nc")).toEqual([
      { kind: "paragraph", lines: ["a", "b"] },
      { kind: "paragraph", lines: ["c"] },
    ]);
  });
});
