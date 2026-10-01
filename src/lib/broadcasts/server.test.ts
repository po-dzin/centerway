/**
 * The sender's decisions, against a database stub that answers exactly the
 * calls `sendNextBatch` / `startBroadcast` make. What is guarded here is what
 * would cost the most to get wrong on a launch day:
 *
 *   · a quota or an outage puts the batch BACK, it does not mark it failed;
 *   · a provider refusal marks the batch failed with the reason;
 *   · the campaign closes as `sent` only when nothing is pending;
 *   · the send refuses when the audience changed after the owner confirmed it.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const sendEmailBatch = vi.fn();
vi.mock("@/lib/db/server", () => ({ serviceClient: () => ({}) }));
vi.mock("@/lib/email/resend", () => ({
  PURCHASE_FROM: "CenterWay <info@send.centerway.net.ua>",
  sendEmail: vi.fn(),
  sendEmailBatch,
}));

const { sendNextBatch, startBroadcast, BroadcastError } = await import("./server");

type Call = { table: string; op: string; filters: unknown[][]; values?: unknown };

function stub(state: {
  status: string;
  claimed: { id: string; address: string; name: string | null }[];
  remaining: number;
  audienceCount?: number;
}) {
  const calls: Call[] = [];
  const rpc: { name: string; args: Record<string, unknown> }[] = [];
  const row = {
    id: "b-1",
    status: state.status,
    title: "t",
    subject: "Тема",
    preheader: "",
    body: "Текст",
    cta_label: null,
    cta_url: null,
    audience: { include: [{ kind: "buyers", product_codes: [] }], exclude_tags: [] },
    recipients_total: 2,
    sent_count: 0,
    failed_count: 0,
    error_text: null,
    created_at: "2026-10-01T00:00:00Z",
    started_at: null,
    finished_at: null,
  };

  const db = {
    from(table: string) {
      const call: Call = { table, op: "", filters: [] };
      calls.push(call);
      const resolve = () => {
        if (table === "broadcasts" && call.op === "select") return { data: row, error: null };
        if (table === "broadcasts" && call.op === "update") return { data: [{ id: "b-1" }], error: null };
        if (table === "broadcast_recipients" && call.op === "select")
          return { data: null, count: state.remaining, error: null };
        return { data: null, error: null };
      };
      const builder: Record<string, unknown> = {};
      for (const m of ["eq", "in", "is", "order", "limit", "range", "not"]) {
        builder[m] = (...args: unknown[]) => {
          call.filters.push([m, ...args]);
          return builder;
        };
      }
      for (const op of ["select", "update", "insert", "delete", "upsert"]) {
        builder[op] = (values?: unknown) => {
          if (!call.op) {
            call.op = op;
            call.values = values;
          }
          return builder;
        };
      }
      builder.maybeSingle = async () => resolve();
      builder.single = async () => resolve();
      builder.then = (ok: (v: unknown) => unknown) => Promise.resolve(resolve()).then(ok);
      return builder;
    },
    async rpc(name: string, args: Record<string, unknown>) {
      rpc.push({ name, args });
      if (name === "broadcast_claim_recipients") return { data: state.claimed, error: null };
      if (name === "broadcast_audience_count") return { data: state.audienceCount ?? 0, error: null };
      if (name === "broadcast_stats") return { data: { total: 2 }, error: null };
      return { data: null, error: null };
    },
  };
  return { db: db as never, calls, rpc };
}

const two = [
  { id: "r-1", address: "a@example.com", name: "Олена" },
  { id: "r-2", address: "b@example.com", name: null },
];

beforeEach(() => {
  sendEmailBatch.mockReset();
  process.env.UNSUBSCRIBE_SECRET = "s";
});

describe("sendNextBatch", () => {
  it("records the provider ids and closes the campaign when nothing is left", async () => {
    sendEmailBatch.mockResolvedValue({ sent: true, ids: ["p-1", "p-2"] });
    const { db, rpc, calls } = stub({ status: "sending", claimed: two, remaining: 0 });
    const out = await sendNextBatch("b-1", db);

    const [messages, opts] = sendEmailBatch.mock.calls[0]!;
    expect(messages).toHaveLength(2);
    expect(messages[0].to).toBe("a@example.com");
    expect(messages[0].headers["List-Unsubscribe"]).toContain("/api/unsubscribe?t=");
    expect(opts.idempotencyKey).toMatch(/^broadcast-b-1-[0-9a-f]{32}$/);

    const mark = rpc.find((r) => r.name === "broadcast_mark_results")!;
    expect(mark.args.p_results).toEqual([
      { id: "r-1", status: "sent", provider_id: "p-1", error_text: null },
      { id: "r-2", status: "sent", provider_id: "p-2", error_text: null },
    ]);
    expect(out.status).toBe("sent");
    expect(
      calls.some(
        (c) => c.table === "broadcasts" && c.op === "update" && (c.values as { status?: string }).status === "sent",
      ),
    ).toBe(true);
  });

  it("puts the batch back on a quota and pauses, instead of failing three hundred people", async () => {
    sendEmailBatch.mockResolvedValue({ sent: false, reason: "rate_limited", detail: "429 daily_quota_exceeded" });
    const { db, rpc } = stub({ status: "sending", claimed: two, remaining: 2 });
    const out = await sendNextBatch("b-1", db);
    const mark = rpc.find((r) => r.name === "broadcast_mark_results")!;
    expect((mark.args.p_results as { status: string }[]).every((r) => r.status === "pending")).toBe(true);
    expect(out).toMatchObject({ status: "sending", paused: "rate_limited" });
  });

  it("marks a refused batch failed, with the reason", async () => {
    sendEmailBatch.mockResolvedValue({ sent: false, reason: "provider_error", detail: "422 invalid from" });
    const { db, rpc } = stub({ status: "sending", claimed: two, remaining: 0 });
    await sendNextBatch("b-1", db);
    const mark = rpc.find((r) => r.name === "broadcast_mark_results")!;
    expect(mark.args.p_results).toEqual([
      { id: "r-1", status: "failed", provider_id: null, error_text: "422 invalid from" },
      { id: "r-2", status: "failed", provider_id: null, error_text: "422 invalid from" },
    ]);
  });

  it("sends nothing for a campaign that is not sending", async () => {
    const { db } = stub({ status: "cancelled", claimed: two, remaining: 2 });
    const out = await sendNextBatch("b-1", db);
    expect(sendEmailBatch).not.toHaveBeenCalled();
    expect(out.status).toBe("cancelled");
  });
});

describe("startBroadcast", () => {
  it("refuses when the audience is not the number the owner confirmed, and freezes nothing", async () => {
    const { db, rpc } = stub({ status: "draft", claimed: [], remaining: 0, audienceCount: 272 });
    await expect(startBroadcast("b-1", 271, db)).rejects.toMatchObject({
      code: "audience_changed",
      status: 409,
      extra: { count: 272 },
    });
    expect(rpc.some((r) => r.name === "broadcast_materialize")).toBe(false);
  });

  it("refuses a campaign that is no longer a draft", async () => {
    const { db } = stub({ status: "sent", claimed: [], remaining: 0, audienceCount: 2 });
    await expect(startBroadcast("b-1", 2, db)).rejects.toBeInstanceOf(BroadcastError);
  });
});
