import { describe, expect, it } from "vitest";

import { feedGateText, feedPlainText, parseFeedBody, safeFeedHref } from "./format";

describe("parseFeedBody — the post's markdown subset", () => {
  it("reads bold, italic and a link inside a paragraph, with a line break kept", () => {
    expect(parseFeedBody("**Ранок** і *тиша*\nдалі [тут](https://centerway.net.ua/feed)")).toEqual([
      {
        t: "p",
        children: [
          { t: "strong", children: [{ t: "text", text: "Ранок" }] },
          { t: "text", text: " і " },
          { t: "em", children: [{ t: "text", text: "тиша" }] },
          { t: "br" },
          { t: "text", text: "далі " },
          { t: "link", href: "https://centerway.net.ua/feed", children: [{ t: "text", text: "тут" }] },
        ],
      },
    ]);
  });

  it("nests italic in bold and bold in a link's words", () => {
    const [block] = parseFeedBody("**дуже *важливо***  [**так**](https://a.ua)");
    expect(block).toMatchObject({
      t: "p",
      children: [
        {
          t: "strong",
          children: [
            { t: "text", text: "дуже " },
            { t: "em", children: [{ t: "text", text: "важливо" }] },
          ],
        },
        { t: "text", text: "  " },
        { t: "link", children: [{ t: "strong", children: [{ t: "text", text: "так" }] }] },
      ],
    });
  });

  it("reads lists, a numbered list with its start, a quote, and paragraphs split by a blank line", () => {
    const body = "Вступ\n\n- раз\n- два\n3. три\n4. чотири\n> цитата\n> далі\n\nКінець";
    expect(parseFeedBody(body).map((block) => block.t)).toEqual(["p", "ul", "ol", "quote", "p"]);
    const ol = parseFeedBody("3. три\n4. чотири")[0];
    expect(ol).toMatchObject({
      t: "ol",
      start: 3,
      items: [[{ t: "text", text: "три" }], [{ t: "text", text: "чотири" }]],
    });
  });

  it("leaves arithmetic, lone stars and escapes as text", () => {
    expect(feedPlainText("2 * 3 * 4")).toBe("2 * 3 * 4");
    expect(feedPlainText("**незакрите")).toBe("**незакрите");
    expect(feedPlainText("\\*не курсив\\*")).toBe("*не курсив*");
  });

  it("never makes an unsafe address clickable, and keeps what the author typed", () => {
    const attacks = [
      "[клік](javascript:alert(1))",
      "[клік](data:text/html,<script>)",
      "[клік](/relative)",
      "[клік](https://user:pw@host.ua)",
      "<img src=x onerror=alert(1)>",
    ];
    for (const body of attacks) {
      const json = JSON.stringify(parseFeedBody(body));
      expect(json).not.toContain('"t":"link"');
      expect(feedPlainText(body)).toBe(body.replace("javascript:alert(1)", "javascript:alert(1)"));
    }
  });

  it("survives any input without throwing, and deep nesting stays text past the limit", () => {
    for (const body of ["", "*", "**", "***", "[", "[]()", "[a](", "> ", "- ", "1.", "*a **b* c**", "\\"]) {
      expect(() => parseFeedBody(body)).not.toThrow();
    }
    expect(() => parseFeedBody("*a ".repeat(3000))).not.toThrow();
    expect(feedPlainText("**a *b **c *d **e***")).toContain("e");
  });
});

describe("plain text — the length limit and the gate", () => {
  it("drops markup for the reader's words; the gate also sees every link's address", () => {
    const body = "**Увага** — [мій курс](https://elsewhere.com/x)\n- пункт";
    expect(feedPlainText(body)).toBe("Увага — мій курс\n\n• пункт");
    expect(feedGateText(body)).toContain("https://elsewhere.com/x");
  });
});

describe("safeFeedHref", () => {
  it("passes http(s) only", () => {
    expect(safeFeedHref("https://centerway.net.ua/a?b=1")).toBe("https://centerway.net.ua/a?b=1");
    expect(safeFeedHref("HTTP://x.ua")).toBe("http://x.ua/");
    expect(safeFeedHref("javascript:alert(1)")).toBeNull();
    expect(safeFeedHref("//x.ua")).toBeNull();
    expect(safeFeedHref("mailto:a@b.ua")).toBeNull();
  });
});
