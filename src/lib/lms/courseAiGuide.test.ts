/**
 * The one file an author hands a neural network (`public/examples/course-ai-guide.md`)
 * carries a JSON Schema and an example. Nothing about either is generated, so
 * this test is what keeps them honest: the example passes the schema AND the
 * real importer, and every enum or limit the schema states is the one the
 * validator enforces. A new block type or category fails here until the guide
 * says it too.
 */

import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  COURSE_CATEGORIES,
  COURSE_CATEGORIES_MAX,
  COURSE_DURATION_DAYS_MAX,
  COURSE_KINDS,
  COURSE_PRETITLE_MAX,
  COURSE_TITLE_MAX,
  LESSON_BLOCK_TYPES,
} from "@/lms-core";
import { preparePortableCourse } from "@/lms-core/portable";

type Schema = Record<string, unknown>;

const guide = readFileSync("public/examples/course-ai-guide.md", "utf8");

function fenceAfter(heading: string): unknown {
  const start = guide.indexOf(`## ${heading}`);
  expect(start, heading).toBeGreaterThanOrEqual(0);
  const body = /```json\n([\s\S]*?)\n```/.exec(guide.slice(start));
  expect(body, heading).not.toBeNull();
  return JSON.parse(body![1]!);
}

const schema = fenceAfter("JSON Schema") as Schema;
const example = fenceAfter("Приклад");

/** The subset of JSON Schema 2020-12 the guide uses — and only that. */
function errors(value: unknown, node: Schema, path = "$"): string[] {
  if (typeof node.$ref === "string") {
    const name = node.$ref.replace("#/$defs/", "");
    return errors(value, (schema.$defs as Record<string, Schema>)[name]!, path);
  }
  const out: string[] = [];
  const fail = (rule: string) => out.push(`${path}: ${rule}`);
  const typeOf = (item: unknown) =>
    Array.isArray(item) ? "array" : item === null ? "null" : Number.isInteger(item) ? "integer" : typeof item;

  if (node.anyOf) {
    if (!(node.anyOf as Schema[]).some((branch) => errors(value, branch, path).length === 0)) fail("anyOf");
    return out;
  }
  if (node.oneOf) {
    const passing = (node.oneOf as Schema[]).filter((branch) => errors(value, branch, path).length === 0).length;
    if (passing !== 1) fail(`oneOf matched ${passing}`);
    return out;
  }
  if ("const" in node && value !== node.const) fail(`const ${String(node.const)}`);
  if (node.enum && !(node.enum as unknown[]).includes(value)) fail(`enum ${JSON.stringify(value)}`);
  if (node.type) {
    const actual = typeOf(value);
    if (!(actual === node.type || (node.type === "number" && actual === "integer"))) fail(`type ${node.type}`);
  }
  if (typeof value === "string") {
    if (typeof node.minLength === "number" && value.length < node.minLength) fail("minLength");
    if (typeof node.maxLength === "number" && value.length > node.maxLength) fail("maxLength");
    if (typeof node.pattern === "string" && !new RegExp(node.pattern).test(value)) fail("pattern");
  }
  if (typeof value === "number") {
    if (typeof node.minimum === "number" && value < node.minimum) fail("minimum");
    if (typeof node.maximum === "number" && value > node.maximum) fail("maximum");
    if (typeof node.exclusiveMinimum === "number" && value <= node.exclusiveMinimum) fail("exclusiveMinimum");
  }
  if (Array.isArray(value)) {
    if (typeof node.minItems === "number" && value.length < node.minItems) fail("minItems");
    if (typeof node.maxItems === "number" && value.length > node.maxItems) fail("maxItems");
    if (node.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) fail("unique");
    if (node.items)
      value.forEach((item, index) => out.push(...errors(item, node.items as Schema, `${path}[${index}]`)));
  }
  if (typeOf(value) === "object") {
    const record = value as Record<string, unknown>;
    const properties = (node.properties ?? {}) as Record<string, Schema>;
    for (const key of (node.required ?? []) as string[]) if (!(key in record)) fail(`required ${key}`);
    for (const [key, child] of Object.entries(record)) {
      if (properties[key]) out.push(...errors(child, properties[key]!, `${path}.${key}`));
      else if (node.additionalProperties === false) fail(`unknown ${key}`);
    }
  }
  return out;
}

const defs = schema.$defs as Record<string, Schema>;
const props = schema.properties as Record<string, Schema>;

describe("course AI guide", () => {
  it("shows the same example as the standalone sample file", () => {
    expect(example).toEqual(JSON.parse(readFileSync("public/examples/course-import.json", "utf8")));
  });

  it("has an example that passes its own schema", () => {
    expect(errors(example, schema)).toEqual([]);
  });

  it("has an example the importer accepts", () => {
    let next = 0;
    const preview = preparePortableCourse(example, { takenSlugs: [], ids: () => `id-${++next}` });
    expect(preview.summary.moduleCount).toBeGreaterThan(0);
  });

  it("refuses the shapes a network invents instead of ours", () => {
    expect(errors({ title: "Курс", lessons: [] }, schema)).toContain("$: required modules");
    const withId = structuredClone(example) as { id?: string };
    withId.id = "x";
    expect(errors(withId, schema)).toContain("$: unknown id");
  });

  it("states the validator's own vocabulary and limits", () => {
    const blockTypes = (defs.block!.oneOf as Schema[]).map((branch) => {
      const name = String(branch.$ref).replace("#/$defs/", "");
      return ((defs[name]!.properties as Record<string, Schema>).type!.const as string) ?? name;
    });
    // `group` is the builder's own composition and `code` has no place in a
    // wellness lesson; neither is offered to a network.
    expect([...blockTypes, "group", "code"].sort()).toEqual([...LESSON_BLOCK_TYPES].sort());
    expect((props.categories!.items as Schema).enum).toEqual([...COURSE_CATEGORIES]);
    expect(props.categories!.maxItems).toBe(COURSE_CATEGORIES_MAX);
    expect(props.kind!.enum).toEqual([...COURSE_KINDS]);
    expect(props.title!.maxLength).toBe(COURSE_TITLE_MAX);
    expect(props.pretitle!.maxLength).toBe(COURSE_PRETITLE_MAX);
    expect(props.durationDays!.maximum).toBe(COURSE_DURATION_DAYS_MAX);
  });
});
