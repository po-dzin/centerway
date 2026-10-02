import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/server", () => ({ serviceClient: () => ({}) }));

const { parseImport } = await import("./server");

describe("parseImport", () => {
  it("reads a SendPulse-style export: header, quotes, name in any column, duplicates", () => {
    const raw =
      'Email;Name;Phone\n"Olena@Example.com";"Олена";380000000\nolena@example.com;;\nivan@example.com\nnot-an-email@\njunk line';
    const out = parseImport(raw);
    expect(out.rows).toEqual([
      { address: "olena@example.com", name: "Олена" },
      { address: "ivan@example.com", name: null },
    ]);
    expect(out.invalid).toEqual(["not-an-email@", "junk line"]);
  });
});
