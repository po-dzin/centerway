/**
 * The room's arithmetic, held to what it does today.
 *
 * `LearnRoomView`'s header says it plainly: this packing was 40 commits of
 * live visual iteration, and re-deriving it blind is how bugs that were
 * already found come back. Until 2026-09-11 it sat inside a client component
 * and nothing could call it. These are not tests of a layout's beauty — that
 * is what eyes are for — but of the properties a reader would notice breaking:
 * every book is placed, nothing is placed outside its niche, one course stands
 * in one place, and the camera returns to the hall when there is nothing to
 * walk up to.
 */

import { describe, expect, it } from "vitest";

import { CATEGORY_ORDER, HALL, frameCase, layoutRoom, toCases, type RoomCase } from "./roomGeometry";
import type { LearnerShelfCourseDto } from "@/components/lms/lmsClient";
import type { CabinetCopy } from "./copy";

const copy = {
  courseCategories: {
    movement: "Рух",
    nutrition: "Харчування",
    cleansing: "Очищення",
    breathing: "Дихання",
    meditation: "Медитація",
    focus: "Фокус",
    energy: "Енергія",
    relaxation: "Релаксація",
  },
} as unknown as CabinetCopy;

function course(slug: string, categories: string[], live = true): LearnerShelfCourseDto {
  return {
    slug,
    title: `Курс ${slug}`,
    categories,
    state: live ? "active" : "locked",
  } as unknown as LearnerShelfCourseDto;
}

function cases(count: number, perCase = 4): RoomCase[] {
  return CATEGORY_ORDER.slice(0, count).map((key, ci) => ({
    ci,
    label: `${ci}`,
    books: Array.from({ length: perCase }, (_, i) => ({
      slug: `${key}-${i}`,
      title: `Курс ${key} ${i}`,
      state: "active",
      live: true,
      course: course(`${key}-${i}`, [key]),
    })),
  }));
}

describe("toCases", () => {
  it("stands a course in one place even when it carries several subjects", () => {
    const built = toCases([course("multi", ["cleansing", "movement"])], copy);
    const homes = built.filter((c) => c.books.length > 0);
    expect(homes).toHaveLength(1);
    expect(homes[0]?.books.map((b) => b.slug)).toEqual(["multi"]);
  });

  it("picks the home by the room's order, not the order the author tapped", () => {
    const tappedOneWay = toCases([course("a", ["cleansing", "movement"])], copy);
    const tappedTheOther = toCases([course("a", ["movement", "cleansing"])], copy);
    expect(tappedOneWay[0]?.ci).toBe(tappedTheOther[0]?.ci);
  });

  it("drops a course with no subject rather than inventing a shelf for it", () => {
    expect(toCases([course("draft", [])], copy)).toEqual([]);
  });
});

describe("layoutRoom", () => {
  it("returns nothing rather than dividing by a zero-sized wall", () => {
    expect(layoutRoom(cases(3), 0, 800, false)).toEqual([]);
    expect(layoutRoom(cases(3), 1200, 0, false)).toEqual([]);
    expect(layoutRoom([], 1200, 800, false)).toEqual([]);
  });

  it("places every book once, or says out loud how many it could not fit", () => {
    /* A wall holds what it holds: past that, the room draws a "+n" marker
       rather than growing. The property worth holding is therefore not "all
       books are drawn" but "no book disappears without being counted" —
       a shelf that quietly loses a course is the exact failure this product
       has met before. */
    for (const perCase of [1, 4, 19, 60]) {
      const built = cases(3, perCase);
      const niches = layoutRoom(built, 1280, 860, false);
      const placed = niches.flatMap((n) => n.books.map((b) => b.slug));
      const hidden = niches.reduce((sum, n) => sum + n.more, 0);
      const total = built.reduce((sum, c) => sum + c.books.length, 0);

      expect(new Set(placed).size, `${perCase} books per case: no book drawn twice`).toBe(placed.length);
      expect(placed.length + hidden, `${perCase} books per case: none lost silently`).toBe(total);
      expect(new Set(placed).size).toBeGreaterThan(0);
    }
  });

  it("keeps every book inside the niche it belongs to", () => {
    for (const niche of layoutRoom(cases(3, 12), 1280, 860, false)) {
      for (const book of niche.books) {
        expect(book.x).toBeGreaterThanOrEqual(-1);
        expect(book.y).toBeGreaterThanOrEqual(-1);
        expect(book.x + book.w).toBeLessThanOrEqual(niche.w + 1);
        expect(book.y + book.h).toBeLessThanOrEqual(niche.h + 1);
      }
    }
  });

  it("gives two sections of one case different keys", () => {
    const keys = layoutRoom(cases(3, 40), 1280, 860, false).map((n) => `${n.ci}:${n.from}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("draws the same room twice for the same shelf", () => {
    const once = layoutRoom(cases(3, 9), 1280, 860, false);
    const twice = layoutRoom(cases(3, 9), 1280, 860, false);
    expect(twice).toEqual(once);
  });

  it("fits the phone's band as well as the desk's", () => {
    const narrow = layoutRoom(cases(3, 9), 390, 760, true);
    expect(narrow.length).toBeGreaterThan(0);
    for (const niche of narrow) {
      expect(niche.w).toBeGreaterThan(0);
      expect(niche.h).toBeGreaterThan(0);
    }
  });
});

describe("frameCase", () => {
  const niches = layoutRoom(cases(3, 9), 1280, 860, false);

  it("stays in the hall when there is nothing to walk up to", () => {
    expect(frameCase(niches, -1, 1280, 860, false)).toEqual(HALL);
    expect(frameCase(niches, 99, 1280, 860, false)).toEqual(HALL);
    expect(frameCase([], 0, 1280, 860, false)).toEqual(HALL);
  });

  it("steps closer to a shelf rather than away from it", () => {
    const camera = frameCase(niches, 1, 1280, 860, false);
    expect(camera.s).toBeGreaterThan(HALL.s);
    expect(Number.isFinite(camera.x)).toBe(true);
    expect(Number.isFinite(camera.y)).toBe(true);
  });
});
