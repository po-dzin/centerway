import { describe, expect, it } from "vitest";

import { snapshotCourses } from "@/lib/lms/catalog";
import { buildCorpus, courseDocs, productDocs, supportDocs, testDocs } from "./corpus";
import { validateCorpus } from "./types";

/**
 * The corpus is assembled from six modules that change for their own reasons,
 * so these tests are less about the assembly than about the two ways it can
 * silently become wrong: leaking paid content, and quoting a number no page
 * would print.
 *
 * Real courses, not fixtures. The shipped snapshot is what `lms:seed` mirrors
 * into the database, so a test over it is a test over the actual material —
 * including the 65 spans of real formatting and the block text that must not
 * appear.
 */
const courses = snapshotCourses();

describe("knowledge corpus", () => {
  it("satisfies its own invariants over the real catalogue", () => {
    expect(validateCorpus(buildCorpus({ courses }))).toEqual([]);
  });

  /**
   * The rule the whole design rests on: a lesson's body is reached through
   * `lesson.read` after an entitlement check, never through a search index.
   * An index is read BEFORE permissions are known, so a snippet in it is a leak
   * the size of the snippet.
   */
  it("never carries a lesson's block text", () => {
    const corpus = courseDocs(courses)
      .map((doc) => doc.text)
      .join("\n");

    const blockTexts = courses.flatMap((course) =>
      course.modules.flatMap((module) =>
        module.lessons.flatMap((lesson) =>
          lesson.blocks.flatMap((block) =>
            Object.entries(block)
              .filter(([field, value]) => typeof value === "string" && field !== "id" && field !== "type")
              .map(([, value]) => value as string),
          ),
        ),
      ),
    );

    const leaked = blockTexts.filter((text) => text.length > 25 && corpus.includes(text));
    expect(leaked).toEqual([]);
  });

  it("names every module, because that is what a buyer asks", () => {
    const way21 = courseDocs(courses).find((doc) => doc.id === "course:way21");
    expect(way21).toBeDefined();
    const titles = courses.find((course) => course.slug === "way21")?.modules.map((module) => module.title) ?? [];
    expect(titles.length).toBeGreaterThan(0);
    for (const title of titles) expect(way21!.text).toContain(title);
  });

  it("quotes an offer's price, and never invents one for a lead", () => {
    const [sold, asked] = productDocs([
      {
        code: "course:short",
        heading: "Short Reboot — онлайн-курс",
        description: null,
        mode: "checkout",
        amount: 795,
        currency: "UAH",
        delivery: "course",
        href: "/programs/reboot",
      },
      {
        code: "consult",
        heading: "Консультація",
        description: null,
        mode: "lead",
        amount: 1500,
        currency: "UAH",
        delivery: "cabinet",
        href: null,
      },
    ]);
    expect(sold?.text).toMatch(/Ціна: 795/);
    expect(asked?.text).toContain("Ціна узгоджується окремо.");
    expect(asked?.text).not.toMatch(/1\s?500/);
  });

  it("carries the house's own support answers verbatim", () => {
    // Not paraphrased: the value of this source is that the answer has already
    // been agreed on and is already being sent to people.
    const where = supportDocs().find((doc) => doc.id === "support:where-course");
    expect(where?.text).toContain("Бібліотека");
    expect(supportDocs().some((doc) => doc.id === "support:other")).toBe(false);
  });

  it("says a test result is a hypothesis, on every test", () => {
    for (const doc of testDocs()) expect(doc.text).toContain("не медичний висновок");
  });

  it("keeps a stable id for everything, so a citation survives a redeploy", () => {
    const ids = buildCorpus({ courses }).map((doc) => doc.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("policy:health-boundary");
  });
});
