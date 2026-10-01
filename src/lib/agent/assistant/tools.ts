/**
 * The assistant's read-only tools, as plain functions over what the server
 * already loaded.
 *
 * PURE ON PURPOSE. Each tool takes an `AssistantWorld` — the knowledge index
 * and the courses a stranger may find — and returns data. The server builds the
 * world once per request (`server.ts`); a test builds it from the snapshot
 * catalogue. That split is what lets §9's gates ("the registry is closed",
 * "no lesson text leaves through a guest tool") run without a model, a
 * database or a network.
 *
 * WHAT A GUEST TOOL MAY RETURN is exactly what the offer page already shows a
 * stranger: titles, the «Вітрина» fields, module and lesson TITLES, the
 * rhythm. Never a block. `course.outline` reads `Course` objects that carry
 * their blocks in memory, so this file is where the line is held — and the
 * test feeds it real courses and searches the output for their block text.
 */

import { inlineToPlainText, type Course } from "@/lms-core";
import { platformTests } from "@/lib/platform/tests";
import { needsHumanHandoff } from "@/lib/agent/knowledge/boundaries";
import { scheduleSentence } from "@/lib/agent/knowledge/corpus";
import { search, type KnowledgeIndex } from "@/lib/agent/knowledge/search";
import { ASSISTANT_TOOLS, type AssistantAudience, type AssistantToolName } from "./registry";

export type AssistantWorld = {
  index: KnowledgeIndex;
  /** Only courses a stranger may find — see `isFindable`. The world is built that way, and the tools check again. */
  courses: Course[];
};

/**
 * May a stranger be told this course exists?
 *
 * Published AND not hidden. Absent visibility MEANS hidden
 * (`src/lms-core/course.ts`, and `courseFromRows` reads the database's
 * `hidden` back as absent), so `visibility !== "hidden"` is the wrong test —
 * it lets every hidden course through. An assistant that names a hidden course
 * has published it.
 */
export function isFindable(course: Course): boolean {
  return course.status === "published" && (course.visibility ?? "hidden") !== "hidden";
}

/** Listed in the catalogue — a narrower set: an unlisted course is sold by link, not by list. */
function isListed(course: Course): boolean {
  return course.status === "published" && course.visibility === "listed";
}

export type ToolResult =
  | { ok: true; data: unknown }
  | { ok: false; code: "unknown_tool" | "not_for_audience" | "invalid_input" | "not_found" };

/** The health boundary document's id in the corpus (`policyDocs`). */
const BOUNDARY_DOC_ID = "policy:health-boundary";

function knowledgeSearch(world: AssistantWorld, query: string, audience: AssistantAudience): ToolResult {
  // The rule runs before the search, as it runs before the model (§4A): a
  // health question is not a retrieval problem, and a lexical hit on a course
  // page would read to the model as permission to answer it.
  const boundary = needsHumanHandoff(query);
  if (boundary.escalate) {
    const doc = world.index.docs.find((candidate) => candidate.id === BOUNDARY_DOC_ID);
    return {
      ok: true,
      data: {
        handoff: true,
        reason: "health",
        documents: doc ? [{ id: doc.id, title: doc.title, href: doc.href, text: doc.text }] : [],
      },
    };
  }

  const hits = search(world.index, query, { limit: 5, audience: audience === "learner" ? "learner" : "public" });
  return {
    ok: true,
    data: {
      handoff: false,
      documents: hits.map(({ doc }) => ({ id: doc.id, title: doc.title, href: doc.href, text: doc.text })),
    },
  };
}

function catalogCourses(world: AssistantWorld): ToolResult {
  return {
    ok: true,
    data: world.courses.filter(isListed).map((course) => ({
      slug: course.slug,
      title: course.title,
      tagline: course.tagline ?? null,
      href: `/programs/${course.programSlug}`,
    })),
  };
}

function courseOutline(world: AssistantWorld, slug: string): ToolResult {
  // By either name a person might use: the row (`short`) or the address
  // (`reboot`). Both lead to the same page, and only a findable course counts.
  const course = world.courses.find((candidate) => candidate.slug === slug || candidate.programSlug === slug);
  if (!course || !isFindable(course)) return { ok: false, code: "not_found" };

  return {
    ok: true,
    data: {
      slug: course.slug,
      title: course.title,
      href: `/programs/${course.programSlug}`,
      durationDays: course.durationDays ?? null,
      schedule: scheduleSentence(course.schedule),
      modules: course.modules.map((module) => ({
        title: module.title,
        reference: module.reference === true,
        lessons: module.lessons.map((lesson) => ({
          title: lesson.title,
          dayIndex: lesson.dayIndex ?? null,
          durationMin: lesson.durationMin ?? null,
        })),
      })),
      summary: course.summary ? inlineToPlainText(course.summary) : null,
    },
  };
}

function testsList(): ToolResult {
  return {
    ok: true,
    data: platformTests.map((test) => ({
      title: test.title,
      tag: test.tag,
      format: test.format,
      description: test.description,
      reads: test.reads,
      href: test.href,
      available: test.status === "active",
    })),
  };
}

/**
 * The one entry point. Name, audience and input are checked HERE, on every
 * call, against the registry — not trusted from whatever list the endpoint
 * happened to hand the model (§2, invariant 2).
 */
export function runAssistantTool(
  world: AssistantWorld,
  audience: AssistantAudience,
  name: string,
  rawInput: unknown,
): ToolResult {
  const spec = ASSISTANT_TOOLS.find((tool) => tool.name === name);
  if (!spec) return { ok: false, code: "unknown_tool" };
  if (!spec.audiences.includes(audience)) return { ok: false, code: "not_for_audience" };

  const parsed = spec.input.safeParse(rawInput ?? {});
  if (!parsed.success) return { ok: false, code: "invalid_input" };
  const input = parsed.data as Record<string, string>;

  switch (spec.name as AssistantToolName) {
    case "knowledge.search":
      return knowledgeSearch(world, input.query ?? "", audience);
    case "catalog.courses":
      return catalogCourses(world);
    case "course.outline":
      return courseOutline(world, input.slug ?? "");
    case "tests.list":
      return testsList();
  }
}
