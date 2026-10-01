import { describe, expect, it } from "vitest";

import offerFixture from "../../../../data/agent/offers-fixture.json";
import type { Course } from "@/lms-core";
import { snapshotCourses } from "@/lib/lms/catalog";
import { buildCorpus, type CorpusOffer } from "@/lib/agent/knowledge/corpus";
import { buildIndex } from "@/lib/agent/knowledge/search";
import { ASSISTANT_TOOLS, assistantToolsFor } from "./registry";
import { isFindable, runAssistantTool, type AssistantWorld } from "./tools";

/**
 * The §9 gates for A2's read-only step (docs/agent-contour-2026-08-21.md),
 * over the real snapshot catalogue rather than fixtures: the block text that
 * must not leak is the actual material.
 */
const courses = snapshotCourses();
const world: AssistantWorld = {
  index: buildIndex(buildCorpus({ courses, offers: offerFixture.offers as CorpusOffer[] })),
  courses: courses.filter(isFindable),
};

/** Every string anywhere inside a lesson's blocks, however deeply nested. */
function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) for (const item of value) strings(item, out);
  else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) if (key !== "id" && key !== "type" && key !== "kind") strings(item, out);
  }
  return out;
}

describe("assistant registry (§9 gate 2: closed)", () => {
  it("is exactly the read-only list the contract names", () => {
    // Adding a tool is a contract change: it fails here first, on purpose.
    expect(ASSISTANT_TOOLS.map((tool) => tool.name).sort()).toEqual(
      ["catalog.courses", "course.outline", "knowledge.search", "tests.list"].sort(),
    );
  });

  it("declares no writing tool in the read-only step", () => {
    expect(ASSISTANT_TOOLS.filter((tool) => tool.writes !== false)).toEqual([]);
  });

  it("gives a guest nothing a learner lacks", () => {
    const learner = new Set(assistantToolsFor("learner").map((tool) => tool.name));
    for (const tool of assistantToolsFor("guest")) expect(learner.has(tool.name)).toBe(true);
  });

  it("refuses a tool that is not in the registry, whatever the model asks for", () => {
    for (const name of ["course.write", "lesson.read", "orders.list", "consult.request", "sql"]) {
      expect(runAssistantTool(world, "learner", name, {})).toEqual({ ok: false, code: "unknown_tool" });
    }
  });

  it("validates input on every call", () => {
    expect(runAssistantTool(world, "guest", "knowledge.search", { query: "" })).toEqual({
      ok: false,
      code: "invalid_input",
    });
    expect(runAssistantTool(world, "guest", "course.outline", { slug: 42 })).toEqual({
      ok: false,
      code: "invalid_input",
    });
  });
});

describe("assistant read-only tools", () => {
  it("never lets a lesson's text out through a guest tool", () => {
    const output = JSON.stringify(
      courses.flatMap((course) => [
        runAssistantTool(world, "guest", "course.outline", { slug: course.slug }),
        runAssistantTool(world, "guest", "knowledge.search", { query: course.title }),
      ]),
    );
    const blockTexts = courses.flatMap((course) =>
      course.modules.flatMap((module) => module.lessons.flatMap((lesson) => strings(lesson.blocks))),
    );
    // Lesson titles are public by design (the outline names them), and a block
    // that repeats one — a cross-reference card — is not leaking anything; nor
    // is a public link such as the support bot's address.
    const titles = new Set(courses.flatMap((course) => course.modules.flatMap((m) => m.lessons.map((l) => l.title))));
    const leaked = blockTexts.filter(
      (text) => text.length > 25 && !titles.has(text) && !/^https?:\/\//.test(text) && output.includes(text),
    );
    expect(leaked).toEqual([]);
  });

  it("outlines a course by its row name and by its address", () => {
    const byRow = runAssistantTool(world, "guest", "course.outline", { slug: "short" });
    const byAddress = runAssistantTool(world, "guest", "course.outline", { slug: "reboot" });
    expect(byRow.ok).toBe(true);
    expect(byAddress).toEqual(byRow);
  });

  it("does not know a hidden or unpublished course exists", () => {
    const base = courses[0]!;
    const hidden: Course = { ...base, slug: "secret", programSlug: "secret", visibility: undefined };
    const draft: Course = { ...base, slug: "draft", programSlug: "draft", status: "draft", visibility: "listed" };
    // Built WITH them, the way a careless caller would — the tool checks again.
    const leaky: AssistantWorld = { ...world, courses: [...world.courses, hidden, draft] };

    expect(isFindable(hidden)).toBe(false);
    expect(runAssistantTool(leaky, "guest", "course.outline", { slug: "secret" })).toEqual({
      ok: false,
      code: "not_found",
    });
    expect(runAssistantTool(leaky, "guest", "course.outline", { slug: "draft" })).toEqual({
      ok: false,
      code: "not_found",
    });
    const listed = runAssistantTool(leaky, "guest", "catalog.courses", {});
    expect(JSON.stringify(listed)).not.toContain('"secret"');
    expect(JSON.stringify(listed)).not.toContain('"draft"');
  });

  it("answers a health question with the boundary, before any search", () => {
    const result = runAssistantTool(world, "guest", "knowledge.search", {
      query: "у мене гіпертонія, чи підходить програма",
    });
    expect(result).toMatchObject({ ok: true, data: { handoff: true, reason: "health" } });
    const data = (result as { data: { documents: { id: string }[] } }).data;
    expect(data.documents.map((doc) => doc.id)).toEqual(["policy:health-boundary"]);
  });

  it("finds an ordinary answer with a link to follow", () => {
    const result = runAssistantTool(world, "guest", "knowledge.search", { query: "де мій курс після оплати" });
    expect(result).toMatchObject({ ok: true, data: { handoff: false } });
    const docs = (result as { data: { documents: { id: string; href: string | null }[] } }).data.documents;
    expect(docs[0]?.id).toBe("support:where-course");
  });

  it("lists tests without interpreting anything", () => {
    const result = runAssistantTool(world, "guest", "tests.list", {});
    expect(result.ok).toBe(true);
    expect(JSON.stringify(result)).toContain("Тест доші");
  });
});
