import { beforeEach, describe, expect, it } from "vitest";

import { FakeSupabase, type Row } from "@/lib/admin/fakeSupabase";

import { isContentKind, listShelf, resolveExperience, takenExperienceNames } from "./registry";

const db = new FakeSupabase();

const thing = (overrides: Partial<Row>): Row => ({
  id: "exp-way21",
  kind: "course",
  slug: "way21",
  author_profile_id: "author-1",
  listed: true,
  sort_order: 3,
  title: null,
  summary: null,
  ...overrides,
});

beforeEach(() => {
  db.tables = {
    experiences: [
      thing({}),
      thing({ id: "exp-reboot", kind: "mini", slug: "reboot", author_profile_id: null, sort_order: 1 }),
      thing({ id: "exp-consult", kind: "consultation", slug: "consult", sort_order: null, title: "Особиста консультація" }),
      thing({ id: "exp-support", kind: "package", slug: "way21-support", listed: false, title: "Супровід" }),
    ],
    experience_aliases: [
      { alias: "detox", experience_id: "exp-way21", kind: "slug" },
      { alias: "short", experience_id: "exp-reboot", kind: "slug" },
      { alias: "way21.centerway.net.ua", experience_id: "exp-way21", kind: "host" },
    ],
  };
  db.failures = {};
});

describe("resolveExperience", () => {
  it("finds a thing by its live address", async () => {
    const found = await resolveExperience(db as never, "way21");
    expect(found).toMatchObject({ via: "slug", experience: { id: "exp-way21", kind: "course" } });
  });

  it("finds it by a name it used to answer to, and says so", async () => {
    const found = await resolveExperience(db as never, "detox");
    expect(found).toMatchObject({ via: "alias", experience: { slug: "way21" } });
  });

  it("finds it by the host of its funnel", async () => {
    const found = await resolveExperience(db as never, "Way21.CenterWay.net.ua");
    expect(found?.experience.slug).toBe("way21");
  });

  it("prefers the live address over a stale alias of the same name", async () => {
    db.tables.experience_aliases!.push({ alias: "consult", experience_id: "exp-way21", kind: "slug" });
    const found = await resolveExperience(db as never, "consult");
    expect(found).toMatchObject({ via: "slug", experience: { id: "exp-consult" } });
  });

  it("answers null for a name nobody holds, and for no name at all", async () => {
    expect(await resolveExperience(db as never, "nope")).toBeNull();
    expect(await resolveExperience(db as never, "  ")).toBeNull();
  });
});

describe("listShelf", () => {
  it("lists only what is on the shelf, in the owner's order", async () => {
    const shelf = await listShelf(db as never);
    expect(shelf.map((row) => row.slug)).toEqual(["reboot", "way21", "consult"]);
  });

  it("narrows by kind and by author", async () => {
    expect((await listShelf(db as never, { kinds: ["consultation"] })).map((row) => row.slug)).toEqual(["consult"]);
    expect((await listShelf(db as never, { authorProfileId: "author-1" })).map((row) => row.slug)).toEqual([
      "way21",
      "consult",
    ]);
  });
});

describe("takenExperienceNames", () => {
  it("holds every address and every forwarding address, but not hosts", async () => {
    const taken = await takenExperienceNames(db as never);
    expect(taken).toEqual(expect.arrayContaining(["way21", "consult", "way21-support", "detox", "short"]));
    expect(taken).not.toContain("way21.centerway.net.ua");
  });
});

describe("isContentKind", () => {
  it("separates the kinds a course stands behind from the ones a person does", () => {
    expect(isContentKind("checklist")).toBe(true);
    expect(isContentKind("consultation")).toBe(false);
  });
});
