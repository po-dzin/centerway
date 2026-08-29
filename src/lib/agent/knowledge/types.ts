/**
 * What the assistant is allowed to know, as a data structure.
 *
 * THE WHOLE POINT IS THE CLOSED LIST. `docs/agent-contour-2026-08-21.md` §4
 * refuses "RAG over the whole site": the platform carries five landings, retired
 * offers and `docs/legacy/**`, and a model given all of it will quote a price
 * from a programme that stopped being sold. So the corpus is ASSEMBLED from
 * named sources rather than crawled, and everything in it is a `KnowledgeDoc`
 * with a provenance field naming the module the sentence came from.
 *
 * A DOC IS A CITATION, NOT A CHUNK. Every entry carries the route a person can
 * open. An answer that cannot name where it read something is an answer the
 * reader cannot check, and on a platform about somebody's body that is the
 * difference between "the course says" and "the assistant said".
 *
 * WHAT IS DELIBERATELY NOT IN HERE: lesson bodies. A course contributes its
 * OUTLINE — what it is, who for, what it costs someone in time, what the
 * modules are called. The text of a paid lesson is reached through
 * `lesson.read`, after `resolveEntitlement`, and never through a search index.
 * An index is a place things leak from: it is read before permissions are
 * known, and a snippet is a leak the size of the snippet.
 */

export type KnowledgeKind =
  /** A thing that can be bought, from `products.ts` / `content.ts`. */
  | "product"
  /** A course, by its offer surface — never its lesson text. */
  | "course"
  /** A platform test and what it reads. */
  | "test"
  /** What support already answers, from the bot's own copy. */
  | "support"
  /** Policy and boundary statements: refunds, access, data, health limits. */
  | "policy";

/**
 * Who may be shown this document.
 *
 * `learner` exists for text that is true only once someone owns something —
 * how the shelf behaves, how access expires. It is not a paywall for content:
 * gated CONTENT does not enter the corpus at all (see the header).
 */
export type KnowledgeAudience = "public" | "learner";

export type KnowledgeDoc = {
  /** Stable and readable — `product:short`, `course:way21`, `support:cabinet`. */
  id: string;
  kind: KnowledgeKind;
  title: string;
  /** Where the reader can go and see this for themselves. Null when there is no page. */
  href: string | null;
  /** Plain text. No markup, no JSX, no HTML — the search and the model read the same string. */
  text: string;
  locale: "uk" | "ru" | "en";
  audience: KnowledgeAudience;
  /** The module this text lives in, so a wrong sentence gets fixed at its source. */
  source: string;
  /** When the underlying thing last changed, when the source knows. */
  updatedAt: string | null;
};

export type CorpusProblem = { id: string; problem: string };

/**
 * Invariants a corpus must satisfy before anything reads it.
 *
 * Checked rather than assumed because the corpus is assembled from six modules
 * that change for their own reasons: a product renamed, a course unpublished, a
 * support answer rewritten. The failure mode is silent — a duplicate id makes
 * one document unreachable, an empty text makes a citation point at nothing —
 * so it is a gate, and the test suite runs it against the real corpus.
 */
export function validateCorpus(docs: KnowledgeDoc[]): CorpusProblem[] {
  const problems: CorpusProblem[] = [];
  const seen = new Set<string>();

  for (const doc of docs) {
    if (seen.has(doc.id)) problems.push({ id: doc.id, problem: "duplicate_id" });
    seen.add(doc.id);

    if (!/^[a-z]+:[a-z0-9-]+$/.test(doc.id)) problems.push({ id: doc.id, problem: "malformed_id" });
    if (doc.title.trim() === "") problems.push({ id: doc.id, problem: "empty_title" });
    // A document with almost no text cannot answer anything, but it CAN win a
    // search on a rare word and become the citation for a question it does not
    // address. Better absent than thin.
    if (doc.text.trim().length < 40) problems.push({ id: doc.id, problem: "text_too_thin" });
    if (doc.href !== null && !doc.href.startsWith("/") && !doc.href.startsWith("https://")) {
      problems.push({ id: doc.id, problem: "href_not_absolute_or_rooted" });
    }
    if (/<[a-z][^>]*>/i.test(doc.text)) problems.push({ id: doc.id, problem: "markup_in_text" });
  }

  return problems;
}
