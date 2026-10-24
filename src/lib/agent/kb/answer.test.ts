import { describe, expect, it } from "vitest";

import type { SearchHit } from "@/lib/agent/knowledge/search";
import type { KnowledgeDoc } from "@/lib/agent/knowledge/types";
import { buildKbPrompt, citedSources, formatKbAnswerHtml, parseKbAsk } from "./answer";

function hit(id: string, title: string, href: string | null, text = "текст"): SearchHit {
  const doc = {
    id,
    kind: "support",
    title,
    href,
    text,
    locale: "uk",
    audience: "public",
    source: "test",
    updatedAt: null,
  };
  return { doc: doc as unknown as KnowledgeDoc, score: 1, terms: [] };
}

describe("kb bot — what counts as a question for it", () => {
  it("takes /ask with or without this bot's name", () => {
    expect(parseKbAsk("/ask де мій курс?", "centerway_support_bot")).toBe("де мій курс?");
    expect(parseKbAsk("/ask@CenterWay_Support_Bot де мій курс?", "centerway_support_bot")).toBe("де мій курс?");
  });

  it("leaves another bot's /ask alone", () => {
    expect(parseKbAsk("/ask@other_bot де мій курс?", "centerway_support_bot")).toBeNull();
  });

  it("returns an empty question for a bare /ask, so the bot can say how", () => {
    expect(parseKbAsk("/ask", "centerway_support_bot")).toBe("");
  });

  it("answers a mention anywhere in the message, without the mention", () => {
    expect(parseKbAsk("@centerway_support_bot як оплатити частинами?", "centerway_support_bot")).toBe(
      "як оплатити частинами?",
    );
    expect(parseKbAsk("а скажи, @centerway_support_bot, коли старт?", "centerway_support_bot")).toBe(
      "а скажи, , коли старт?",
    );
  });

  it("ignores other commands, even ones addressed to this bot", () => {
    expect(parseKbAsk("/support@centerway_support_bot", "centerway_support_bot")).toBeNull();
    expect(parseKbAsk("/help@centerway_support_bot", "centerway_support_bot")).toBeNull();
    expect(parseKbAsk("/courses", "centerway_support_bot")).toBeNull();
  });

  it("stays silent on ordinary group talk", () => {
    expect(parseKbAsk("колеги, хто сьогодні на зв'язку?", "centerway_support_bot")).toBeNull();
    expect(parseKbAsk("@centerway_support_bot_old привіт", "centerway_support_bot")).toBeNull();
  });
});

describe("kb bot — prompt and answer", () => {
  it("numbers the sources the model reads and puts the question last", () => {
    const prompt = buildKbPrompt("Де курс?", [hit("a", "Де мій курс", "/learn"), hit("b", "Оплата", null)]);
    expect(prompt).toContain("[1] Де мій курс");
    expect(prompt).toContain("[2] Оплата");
    expect(prompt.trim().endsWith("Питання: Де курс?")).toBe(true);
  });

  it("lists only the cited sources, as absolute links we built", () => {
    const html = formatKbAnswerHtml("Курс у кабінеті [2].", [
      hit("a", "Оплата", "/pay"),
      hit("b", "Де мій курс", "/learn"),
    ]);
    expect(html).toContain('[2] <a href="https://www.centerway.net.ua/learn">Де мій курс</a>');
    expect(html).not.toContain("Оплата");
  });

  it("escapes whatever the model wrote", () => {
    const html = formatKbAnswerHtml("<b>жирно</b> & ще [1]", [hit("a", "Док", null)]);
    expect(html).toContain("[1] Док");
    expect(html.startsWith("&lt;b&gt;жирно&lt;/b&gt; &amp; ще [1]")).toBe(true);
  });

  it("lists no sources under an answer that cites none", () => {
    expect(formatKbAnswerHtml("У джерелах цього немає.", [hit("a", "Один", null)])).toBe("У джерелах цього немає.");
  });

  it("reads single marks, runs and ranges", () => {
    expect([...citedSources("так [2], і ще [1][3]")].sort()).toEqual([1, 2, 3]);
    expect([...citedSources("нічого немає [1–4]")]).toEqual([1, 2, 3, 4]);
    expect(citedSources("без джерел").size).toBe(0);
  });
});
