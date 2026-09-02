import { describe, expect, it, vi } from "vitest";

import { FakeSupabase } from "@/lib/admin/fakeSupabase";

vi.mock("@/lib/auth/adminClient", () => ({ adminClient: vi.fn() }));

async function withDatabase() {
  const { adminClient } = await import("@/lib/auth/adminClient");
  const db = new FakeSupabase({ agent_questions: [] });
  vi.mocked(adminClient).mockImplementation(() => db as never);
  return { db, module: await import("./store") };
}

describe("captureQuestion", () => {
  it("stores the redacted text, never the raw one", async () => {
    const { db, module } = await withDatabase();
    await module.captureQuestion({
      text: "Оплатив з пошти ivan@gmail.com, доступу немає",
      source: "bot_support",
    });

    const [row] = db.tables.agent_questions;
    expect(row.text).toBe("Оплатив з пошти [пошта], доступу немає");
    expect(row.text).not.toContain("ivan@gmail.com");
    // The kinds that were removed, so the redactor's reach is auditable —
    // without the table holding what it caught.
    expect(row.redacted).toEqual(["email"]);
  });

  it("stores nothing identifying beside the question", async () => {
    // The columns are the guarantee: there is nowhere to put a telegram id, so
    // no future caller can add one by passing an extra field.
    const { db, module } = await withDatabase();
    await module.captureQuestion({ text: "Коли відкриється наступний урок?", source: "bot_fallback" });

    // `id` is the fake's own primary key; everything else is what the module
    // actually wrote.
    const written = Object.keys(db.tables.agent_questions[0]).filter((column) => column !== "id");
    expect(written.sort()).toEqual(["redacted", "source", "text"]);
  });

  it("drops an acknowledgement and a bare contact", async () => {
    const { db, module } = await withDatabase();
    expect(await module.captureQuestion({ text: "дякую", source: "bot_fallback" })).toBe(false);
    expect(await module.captureQuestion({ text: "ivan@gmail.com", source: "bot_support" })).toBe(false);
    expect(db.tables.agent_questions).toHaveLength(0);
  });

  it("keeps the same question twice, because frequency is the signal", async () => {
    const { db, module } = await withDatabase();
    await module.captureQuestion({ text: "Де подивитися свій прогрес?", source: "bot_fallback" });
    await module.captureQuestion({ text: "Де подивитися свій прогрес?", source: "bot_fallback" });
    expect(db.tables.agent_questions).toHaveLength(2);
  });

  it("never throws into the conversation when the table is unavailable", async () => {
    // A person asking support for help must not see an error because a corpus
    // table was down. The capture is an observation, never a step.
    const { db, module } = await withDatabase();
    db.failures["agent_questions:insert"] = "relation does not exist";
    await expect(
      module.captureQuestion({ text: "Чому не приходить лист для входу?", source: "bot_support" }),
    ).resolves.toBe(false);
  });
});
