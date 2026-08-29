/**
 * Finding the right documents — with no embeddings, and that is a decision.
 *
 * WHY NOT VECTORS. The corpus is on the order of forty documents and grows by
 * one when a course is published. Embeddings would add: a model call on every
 * question, a second one on every content change, a pgvector migration, a
 * re-index job, and a failure mode where retrieval silently degrades because
 * nobody noticed the index went stale. In exchange for that, on forty
 * documents, they would buy almost nothing — lexical search over a corpus this
 * size is not the weak link. The weak link is whether the corpus says the right
 * thing at all.
 *
 * So: BM25 over a normalised token index, deterministic, unit-testable, zero
 * infrastructure and zero per-query cost. When the corpus outgrows it — the
 * honest signal is questions that fail because the words differ from the
 * document's words, not a number of documents — vectors go in beside this, and
 * this stays as the lexical half of a hybrid.
 *
 * PREFIX MATCHING INSTEAD OF A STEMMER. Ukrainian and Russian inflect heavily:
 * «оплата / оплати / оплатою», «курс / курсу / курси». A real stemmer for two
 * Slavic languages is a library and a maintenance surface; cutting a token to
 * its first characters and matching by prefix gets the same recall here for
 * four lines of code. Tokens shorter than the prefix length must match exactly,
 * or «як» would match «якість».
 */

import type { KnowledgeDoc } from "./types";

const PREFIX = 5;

/** BM25 constants, at their textbook defaults — nothing here justifies tuning them. */
const K1 = 1.2;
const B = 0.75;

/**
 * Lowercase, fold the letters that are typed interchangeably, split on anything
 * that is not a letter or a digit.
 *
 * Only two folds, and both are typing habits rather than linguistics: «ё» for
 * «е», and the apostrophe forms Ukrainian keyboards disagree about. Notably NOT
 * folded: «і» and «и», which are different letters in Ukrainian — folding them
 * would merge words the language keeps apart.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/['’‘`]/g, "'")
    .split(/[^\p{L}\p{N}']+/u)
    .filter((token) => token.length > 1);
}

function key(token: string): string {
  return token.length <= PREFIX ? token : token.slice(0, PREFIX);
}

export type KnowledgeIndex = {
  docs: KnowledgeDoc[];
  /** Term key → doc position → term frequency. */
  postings: Map<string, Map<number, number>>;
  lengths: number[];
  averageLength: number;
};

export function buildIndex(docs: KnowledgeDoc[]): KnowledgeIndex {
  const postings = new Map<string, Map<number, number>>();
  const lengths: number[] = [];

  docs.forEach((doc, position) => {
    // The title is worth more than a line in the body — a person asking about
    // «Шлях 21» means the document called that, not every document mentioning
    // it — so it is indexed twice rather than given a separate scoring field.
    const tokens = [...tokenize(doc.title), ...tokenize(doc.title), ...tokenize(doc.text)];
    lengths.push(tokens.length);

    for (const token of tokens) {
      const term = key(token);
      let byDoc = postings.get(term);
      if (!byDoc) postings.set(term, (byDoc = new Map()));
      byDoc.set(position, (byDoc.get(position) ?? 0) + 1);
    }
  });

  const total = lengths.reduce((sum, length) => sum + length, 0);
  return { docs, postings, lengths, averageLength: lengths.length ? total / lengths.length : 0 };
}

export type SearchHit = { doc: KnowledgeDoc; score: number; terms: string[] };

export function search(
  index: KnowledgeIndex,
  query: string,
  options: { limit?: number; audience?: KnowledgeDoc["audience"] } = {}
): SearchHit[] {
  const limit = options.limit ?? 5;
  const queryTerms = [...new Set(tokenize(query).map(key))];
  if (queryTerms.length === 0) return [];

  const scores = new Map<number, { score: number; terms: Set<string> }>();
  const documentCount = index.docs.length;

  for (const term of queryTerms) {
    const byDoc = index.postings.get(term);
    if (!byDoc) continue;

    // A term present in nearly every document tells us nothing about which one
    // to read — "курс" on this platform is close to a stop word — and BM25's
    // IDF is what says so, without a hand-kept stop list in two languages.
    const idf = Math.log(1 + (documentCount - byDoc.size + 0.5) / (byDoc.size + 0.5));

    for (const [position, frequency] of byDoc) {
      const length = index.lengths[position];
      const denominator = frequency + K1 * (1 - B + (B * length) / (index.averageLength || 1));
      const contribution = idf * ((frequency * (K1 + 1)) / denominator);

      const current = scores.get(position) ?? { score: 0, terms: new Set<string>() };
      current.score += contribution;
      current.terms.add(term);
      scores.set(position, current);
    }
  }

  return [...scores.entries()]
    .map(([position, { score, terms }]) => ({ doc: index.docs[position], score, terms: [...terms] }))
    // Audience is filtered AFTER scoring but BEFORE the model sees anything —
    // and this is the last line of the search, not the first line of a prompt.
    // What a person may read is not a thing to ask a model to remember.
    .filter((hit) => (options.audience === "learner" ? true : hit.doc.audience === "public"))
    // Ties are broken by id so the same question returns the same order — an
    // assistant that cites a different page on a refresh looks like it is
    // making things up, whether or not it is.
    .sort((left, right) => right.score - left.score || left.doc.id.localeCompare(right.doc.id))
    .slice(0, limit);
}
