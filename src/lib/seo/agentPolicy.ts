/**
 * What an outside agent may do with the platform's text — one place, read by
 * `/robots.txt` and `/llms.txt`. The decision and its reasons are in
 * `docs/external-agents-policy-2026-10-01.md`.
 *
 * CITED, NOT TRAINED. Search and answer engines, and assistants fetching a
 * page because a person asked, read everything public: that is how the
 * platform ends up in an answer with a link. Crawlers that collect text to
 * train models are refused, because most of what the showcase publishes —
 * course descriptions, author profiles — belongs to the author who wrote it,
 * and a licence to train on it is not the platform's to grant.
 *
 * ONLY TRAINING-ONLY USER AGENTS. Every vendor here runs a separate agent for
 * search and for user-triggered fetches (OAI-SearchBot, ChatGPT-User,
 * Claude-SearchBot, Claude-User, PerplexityBot…), and those must keep working.
 * A crawler that serves both purposes under one name (Googlebot, Bingbot,
 * Amazonbot) is NOT listed: refusing it would refuse search.
 */

export const TRAINING_CRAWLERS = [
  "GPTBot", // OpenAI, training
  "ClaudeBot", // Anthropic, training
  "Google-Extended", // Gemini training token; Googlebot search is unaffected
  "Applebot-Extended", // Apple training token; Applebot search is unaffected
  "meta-externalagent", // Meta, training
  "CCBot", // Common Crawl, the corpus most models are trained on
  "Bytespider", // ByteDance, training
  "cohere-training-data-crawler", // Cohere, training
] as const;

/**
 * The same decision as a machine-readable line (contentsignals.org), for the
 * crawlers that are not named above. `ai-input` is the answer-with-a-link case
 * and stays open; `ai-train` is the one closed.
 */
export const CONTENT_SIGNAL = "search=yes, ai-input=yes, ai-train=no";

const SITEMAP = "https://www.centerway.net.ua/sitemap.xml";

/**
 * Two hosts, two answers. `www` is the showcase and is meant to be read. `my`
 * is somebody's own shelf, player and builder: nothing there is addressed to a
 * stranger and everything needs a session, so one rule closes the whole host
 * rather than `robots: { index: false }` repeated per route and forgotten on
 * the next one. The session, not this file, is what actually protects it.
 */
export function renderRobots({ personal }: { personal: boolean }): string {
  if (personal) {
    return ["User-Agent: *", "Disallow: /", ""].join("\n");
  }

  return [
    "# Цитувати можна, навчати моделі — ні. Деталі: https://www.centerway.net.ua/llms.txt",
    "",
    "User-Agent: *",
    `Content-Signal: ${CONTENT_SIGNAL}`,
    "Allow: /",
    "",
    ...TRAINING_CRAWLERS.map((agent) => `User-Agent: ${agent}`),
    "Disallow: /",
    "",
    `Sitemap: ${SITEMAP}`,
    "",
  ].join("\n");
}

/** The section `/llms.txt` closes its rules with, in the language of the pages. */
export const AGENT_RULES_UA = [
  "Сторінки можна цитувати й переказувати з посиланням на сторінку-джерело.",
  "Навчати моделі на текстах платформи не можна: описи програм і профілі належать їхнім авторам.",
  "Агент може підібрати програму і привести на сторінку оплати; оплату підтверджує сама людина.",
  "Межі методу вище — частина будь-якого переказу: без діагнозів і обіцянок лікування.",
] as const;
