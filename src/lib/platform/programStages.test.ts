import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Course } from "@/lms-core/course";
import { programStages } from "./programStages";

const shipped = (slug: string) =>
  JSON.parse(readFileSync(path.resolve(__dirname, `../../../data/courses/${slug}.json`), "utf8")) as Course;

describe("programStages", () => {
  it("walks a daily course by its modules, with each stage's days", () => {
    const stages = programStages(shipped("way21"));
    expect(stages?.map((stage) => stage.kicker)).toEqual(["День 1", "Дні 2–7", "Дні 8–14", "Дні 15–21"]);
    expect(stages?.[1]?.summary).toMatch(/^Підготовка/);
  });

  it("leaves out reference, linked and empty modules", () => {
    const stages = programStages(shipped("natural-body"));
    expect(stages?.map((stage) => stage.title)).toEqual([
      "Основи Аюрведи",
      "Харчування і ритм дня",
      "Гуни і баланс дош",
    ]);
  });

  it("counts lessons when the course is not daily", () => {
    expect(programStages(shipped("reset-day"))?.map((stage) => stage.kicker)).toEqual(["2 уроки", "3 уроки"]);
  });

  it("is no route at all with a single module", () => {
    expect(programStages(shipped("short"))).toBeNull();
  });
});
