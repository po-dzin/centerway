/**
 * The knowledge-base bot's answer, as pure functions (2026-10-22).
 *
 * Everything the team will read — the prompt the model gets, the message that
 * goes back to the chat — is built here, with no database and no network, so a
 * test reads exactly what the group will read.
 *
 * THE MODEL WRITES PROSE, WE WRITE THE LINKS. It is asked to mark claims with
 * [1], [2]; the list of sources under the answer is assembled from the search
 * hits, not from the model's text. A model can mistype a URL; it cannot mistype
 * one it never writes.
 */

import { escapeTelegramHtml } from "@/lib/telegram/tg";
import { platformUrl } from "@/lib/surfaces/catalog";
import type { SearchHit } from "@/lib/agent/knowledge/search";

/** How many documents the model reads. Recall at 4 is what the eval measures for. */
export const KB_SOURCE_LIMIT = 4;
/** Per document; the corpus is short pages, this only bounds a long programme text. */
const SOURCE_CHARS = 1500;

export const KB_SYSTEM_PROMPT = [
  "Ти — помічник CenterWay у робочому чаті Telegram.",
  // The voice is G's (22.10): an Ayurvedic doctor-philosopher, an integral practitioner.
  "Твій голос — голос аюрведичного лікаря-філософа, інтегрального практика: медитація, йога, цигун, харчування і сучасні технології, зокрема ШІ.",
  "Ти бачиш, як давні традиції і сучасне життя доповнюють одне одного, і зводиш усе до простої робочої практики: що людина може зробити сьогодні.",
  "Говориш спокійно, тепло і по суті, без пафосу, езотеричних кліше і повчань.",
  "Відповідаєш на питання про платформу, курси, оплату й доступ — тільки за джерелами, які тобі дали.",
  "Правила:",
  "- Пиши українською, на «ви», коротко: 2–5 речень, без вступів і без повторення питання.",
  "- Кожне твердження спирай на джерело і став його номер у квадратних дужках, наприклад [1].",
  "- Якщо в джерелах немає відповіді, скажи це одним реченням і не став номерів джерел. Не вигадуй цін, дат, умов чи посилань.",
  "- Голос лікаря — це тон, не роль: тут ти не лікуєш. Не давай медичних порад, не обіцяй результатів для здоровʼя, не став діагнозів.",
  "- Звичайний текст, без markdown.",
].join("\n");

export const kbCopy = {
  emptyQuestion: "Напишіть питання після /ask, і я відповім за базою знань.",
  handoff: "Це питання про здоровʼя конкретної людини. На нього відповідає фахівець, не бот, тому я його не розбираю.",
  noSources: "У базі знань немає відповіді на це питання. Я записав його, щоб базу доповнили.",
  budget: "Ліміт відповідей бота на сьогодні вичерпано. Завтра знову відповідатиму.",
  failed: "Зараз не вийшло відповісти. Спробуйте ще раз трохи згодом.",
  sourcesHeading: "Джерела:",
} as const;

/**
 * The question in a group message, or null when the message is not for the bot.
 *
 * For the bot: `/ask …`, `/ask@thisbot …`, or a message that mentions
 * @thisbot anywhere. Another bot's `/ask@other` is not ours. Returns "" for a
 * bare `/ask` so the caller can say how to use it.
 */
export function parseKbAsk(text: string, botUsername: string): string | null {
  const trimmed = text.trim();
  const bot = botUsername.toLowerCase();

  const command = /^\/ask(?:@(\w+))?(?:\s+([\s\S]*))?$/i.exec(trimmed);
  if (command) {
    if (command[1] && command[1].toLowerCase() !== bot) return null;
    return (command[2] ?? "").trim();
  }

  if (!bot) return null;
  const mention = new RegExp(`@${bot}\\b`, "gi");
  if (!mention.test(trimmed)) return null;
  return trimmed.replace(mention, " ").replace(/\s+/g, " ").trim();
}

export function buildKbPrompt(question: string, hits: SearchHit[]): string {
  const sources = hits.map((hit, position) => {
    const body = hit.doc.text.length > SOURCE_CHARS ? `${hit.doc.text.slice(0, SOURCE_CHARS)}…` : hit.doc.text;
    return `[${position + 1}] ${hit.doc.title}\n${body}`;
  });
  return [`Джерела:\n\n${sources.join("\n\n")}`, `Питання: ${question}`].join("\n\n---\n\n");
}

/**
 * The source numbers an answer leans on: [2], [1][3], and the [1–4] a model
 * sometimes writes for a range.
 *
 * EMPTY MEANS UNANSWERED. The prompt asks for no marks when the sources hold no
 * answer, and the eval (22.10) showed the model keeps to it — so an answer with
 * no marks is treated as "the corpus did not know", gets no source list, and
 * its question is captured for the corpus like one retrieval found nothing for.
 */
export function citedSources(answer: string): Set<number> {
  const cited = new Set<number>();
  for (const match of answer.matchAll(/\[(\d+)(?:\s*[–—-]\s*(\d+))?\]/g)) {
    const from = Number(match[1]);
    const to = match[2] ? Number(match[2]) : from;
    for (let n = from; n <= Math.min(to, from + 10); n += 1) cited.add(n);
  }
  return cited;
}

/** The answer as Telegram HTML: the model's text escaped, then the sources it cited. */
export function formatKbAnswerHtml(answer: string, hits: SearchHit[]): string {
  const cited = citedSources(answer);
  const lines = hits.flatMap((hit, position) => {
    const n = position + 1;
    // Only what the answer actually leans on — a list of four links under a
    // two-sentence answer reads as padding.
    if (!cited.has(n)) return [];
    const title = escapeTelegramHtml(hit.doc.title);
    return [
      hit.doc.href
        ? `[${n}] <a href="${escapeTelegramHtml(platformUrl(hit.doc.href))}">${title}</a>`
        : `[${n}] ${title}`,
    ];
  });
  const body = escapeTelegramHtml(answer.trim());
  return lines.length ? `${body}\n\n${kbCopy.sourcesHeading}\n${lines.join("\n")}` : body;
}
