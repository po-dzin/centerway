import { describe, expect, it } from "vitest";

import { snapshotCourses } from "@/lib/lms/catalog";
import { buildCorpus } from "./corpus";
import { buildIndex, search, tokenize } from "./search";
import type { KnowledgeDoc } from "./types";

const index = buildIndex(buildCorpus({ courses: snapshotCourses() }));

function ids(query: string, options?: Parameters<typeof search>[2]): string[] {
  return search(index, query, options).map((hit) => hit.doc.id);
}

describe("tokenize", () => {
  it("folds the letters people type interchangeably", () => {
    expect(tokenize("Ёлка")).toEqual(tokenize("Елка"));
  });

  it("keeps і and и apart, because Ukrainian does", () => {
    // Folding them would merge words the language distinguishes — the kind of
    // "helpful" normalisation that makes a search quietly wrong in one language
    // to be slightly better in another.
    expect(tokenize("сіль")).not.toEqual(tokenize("силь"));
  });
});

describe("knowledge search", () => {
  /**
   * The questions this assistant exists to answer, asked the way people ask
   * them — not with the words the documents use. These are the real support
   * FAQ topics, and each one has a right answer in the corpus.
   */
  it("finds the cabinet answer for «де мій курс»", () => {
    expect(ids("де мій курс після оплати")).toContain("support:where-course");
  });

  it("finds the sign-in answer for a question about a missing letter", () => {
    expect(ids("не приходить лист для входу")).toContain("support:login");
  });

  it("finds the health boundary when asked about contraindications", () => {
    // The one document written for the corpus rather than lifted from a page,
    // and the one whose retrieval matters most: everything else is a product
    // question, this is the question we must not answer ourselves.
    expect(ids("чи можна мені це при захворюванні")).toContain("policy:health-boundary");
  });

  it("matches an inflected form against the document's own form", () => {
    // «оплатою» in the question, «оплата»/«оплати» in the documents.
    expect(ids("проблема з оплатою").length).toBeGreaterThan(0);
  });

  it("returns nothing for an empty or wordless query rather than the whole corpus", () => {
    expect(ids("")).toEqual([]);
    expect(ids("?!  —")).toEqual([]);
  });

  it("orders identically for the same question, twice", () => {
    // An assistant that cites a different page on a refresh reads as invention,
    // whether or not it is.
    expect(ids("тест доші")).toEqual(ids("тест доші"));
  });

  it("respects the limit", () => {
    expect(ids("курс", { limit: 3 }).length).toBeLessThanOrEqual(3);
  });

  it("never returns a learner-only document to a guest", () => {
    const learnerOnly: KnowledgeDoc = {
      id: "policy:shelf-behaviour",
      kind: "policy",
      title: "Як працює полиця",
      href: "/learn",
      text: "Полиця показує курси, до яких у вас є доступ, і скільки днів лишилося до завершення доступу.",
      locale: "uk",
      audience: "learner",
      source: "test",
      updatedAt: null,
    };
    const mixed = buildIndex([...buildCorpus({ courses: snapshotCourses() }), learnerOnly]);

    expect(search(mixed, "полиця доступ днів").map((hit) => hit.doc.id)).not.toContain("policy:shelf-behaviour");
    expect(search(mixed, "полиця доступ днів", { audience: "learner" }).map((hit) => hit.doc.id)).toContain(
      "policy:shelf-behaviour",
    );
  });
});
