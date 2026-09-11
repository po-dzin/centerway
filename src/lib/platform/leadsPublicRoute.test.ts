/**
 * `/api/leads` as an attacker sees it: public, unauthenticated, CORS-open, and
 * it upserts on whatever contact was typed into it.
 *
 * That last property is not a bug — a lead from somebody who has bought before
 * MUST land on their existing row, or the spine grows a second identity for
 * every returning person. The danger is what gets written once it lands there.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const customers = new Map<string, { id: string; email: string | null; display_name: string | null; tags: string[] }>();
const leads: Array<Record<string, unknown>> = [];
const attempts = new Map<string, { id: string; status: string; result_type: string | null }>();

vi.mock("@/lib/api/rateLimit", () => ({
  enforceRateLimit: async () => ({ allowed: true }),
  tooManyRequests: () => new Response(null, { status: 429 }),
}));

vi.mock("@/lib/telegram/tg", () => ({ sendTelegramMessage: async () => undefined }));

vi.mock("@/lib/payments/checkoutFlow", () => ({
  persistLeadBestEffort: async (_db: unknown, lead: Record<string, unknown>) => {
    leads.push(lead);
    return "leads";
  },
}));

vi.mock("@/lib/dosha/doshaTestRepo", () => ({
  loadTestAttempt: async (_db: unknown, id: string) => attempts.get(id) ?? null,
  applyDoshaTagsToCustomer: async (_db: unknown, params: { customerId: string; resultType: string }) => {
    const row = customers.get(params.customerId);
    if (row) row.tags = [...new Set([...row.tags, "test_completed", `dosha_${params.resultType}`])];
  },
}));

vi.mock("@/lib/platform/customerIdentity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/platform/customerIdentity")>();
  return {
    ...actual,
    upsertCustomerByContact: async (_db: unknown, contact: { email?: string | null }) => {
      const email = (contact.email ?? "").trim().toLowerCase();
      for (const row of customers.values()) {
        if (row.email === email) return { id: row.id, created: false };
      }
      const id = `c${customers.size + 1}`;
      customers.set(id, { id, email, display_name: null, tags: [] });
      return { id, created: true };
    },
  };
});

/**
 * The chain this mock answers, named rather than left as `any` — exactly the
 * calls the route makes through the admin client. A method the route starts
 * using and this mock has not grown is a type error here rather than an
 * `undefined is not a function` halfway through a request.
 */
type MockBuilder = {
  _filters: Array<[string, unknown]>;
  /** The pending `.update()` patch; its presence is what makes this a write. */
  _patch?: Record<string, unknown>;
  select(): MockBuilder;
  insert(): Promise<{ error: null }>;
  eq(column: string, value: unknown): MockBuilder;
  update(patch: Record<string, unknown>): MockBuilder;
  maybeSingle(): Promise<{ data: null }>;
  then(resolve: (value: { data: null; error: null }) => unknown): unknown;
};

vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => {
      const builder: MockBuilder = {
        _filters: [],
        select: () => builder,
        insert: async () => ({ error: null }),
        eq(column: string, value: unknown) {
          builder._filters.push([column, value]);
          return builder;
        },
        update(patch: Record<string, unknown>) {
          builder._patch = patch;
          return builder;
        },
        maybeSingle: async () => ({ data: null }),
        then(resolve: (value: { data: null; error: null }) => unknown) {
          const patch = builder._patch;
          if (table === "customers" && patch) {
            const id = builder._filters.find(([c]) => c === "id")?.[1] as string;
            const row = customers.get(id);
            if (row) Object.assign(row, patch);
          }
          return resolve({ data: null, error: null });
        },
      };
      return builder;
    },
  }),
}));

const route = await import("@/app/api/leads/route");

function post(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/leads", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  customers.clear();
  leads.length = 0;
  attempts.clear();
});

describe("a stranger submitting somebody else's address", () => {
  beforeEach(() => {
    customers.set("victim", {
      id: "victim",
      email: "buyer@example.com",
      display_name: "Олена Справжня",
      tags: ["customer"],
    });
    attempts.set("att-1", { id: "att-1", status: "completed", result_type: "vata" });
  });

  it("cannot overwrite an existing customer's display name", async () => {
    const res = await route.POST(post({ name: "ЗЛОВМИСНИК", email: "buyer@example.com", phone: "+380501112233" }));
    expect(res.status).toBe(200);
    expect(customers.get("victim")!.display_name).toBe("Олена Справжня");
  });

  it("cannot tag an existing customer with a dosha they never took", async () => {
    // The attempt itself is real and completed — what is unverified is the link
    // between that attempt and this email, which is the whole attack.
    await route.POST(post({ name: "x", email: "buyer@example.com", attempt_id: "att-1" }));
    expect(customers.get("victim")!.tags).toEqual(["customer"]);
  });

  it("still records the claim, because a lead is not a lie — it is a request", async () => {
    await route.POST(post({ name: "ЗЛОВМИСНИК", email: "buyer@example.com", attempt_id: "att-1" }));
    expect(leads).toHaveLength(1);
    expect(leads[0]!.name).toBe("ЗЛОВМИСНИК");
    expect((leads[0]!.payload as Record<string, unknown>).dosha_result_type).toBe("vata");
  });
});

describe("a person we have never seen", () => {
  it("gets their name and their verified dosha written straight on", async () => {
    // No history to corrupt, so nothing is being taken from anybody.
    attempts.set("att-2", { id: "att-2", status: "completed", result_type: "pitta" });
    await route.POST(post({ name: "Нова Людина", email: "new@example.com", attempt_id: "att-2" }));
    const created = [...customers.values()].find((row) => row.email === "new@example.com")!;
    expect(created.display_name).toBe("Нова Людина");
    expect(created.tags).toContain("dosha_pitta");
  });
});

describe("what the form will accept as a test result", () => {
  it("ignores an attempt that was started but never finished", async () => {
    attempts.set("half", { id: "half", status: "started", result_type: "kapha" });
    await route.POST(post({ name: "x", email: "a@example.com", attempt_id: "half" }));
    expect((leads[0]!.payload as Record<string, unknown>).dosha_result_type).toBeUndefined();
  });

  it("ignores an attempt id that does not exist", async () => {
    await route.POST(post({ name: "x", email: "a@example.com", attempt_id: "nope" }));
    expect((leads[0]!.payload as Record<string, unknown>).dosha_result_type).toBeUndefined();
  });

  it("keeps a page-supplied ?dosha= as a claim and never as a result", async () => {
    await route.POST(post({ name: "x", email: "a@example.com", dosha: "vata" }));
    const payload = leads[0]!.payload as Record<string, unknown>;
    expect(payload.dosha_claimed).toBe("vata");
    expect(payload.dosha_result_type).toBeUndefined();
  });

  it("refuses a made-up dosha outright, in either field", async () => {
    await route.POST(post({ name: "x", email: "a@example.com", dosha: "<script>alert(1)</script>" }));
    const payload = leads[0]!.payload as Record<string, unknown>;
    expect(payload.dosha_claimed).toBeUndefined();
    expect(payload.dosha_result_type).toBeUndefined();
  });

  it("does not let a claimed dosha become a tag on anybody", async () => {
    await route.POST(post({ name: "x", email: "new2@example.com", dosha: "vata" }));
    const created = [...customers.values()].find((row) => row.email === "new2@example.com")!;
    expect(created.tags).toEqual([]);
  });
});

describe("the contact requirement", () => {
  it("rejects a submission with a name and no way to reach anybody", async () => {
    const res = await route.POST(post({ name: "x" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: "contact_required" });
    expect(customers.size).toBe(0);
  });

  it("rejects a submission with a contact and no name", async () => {
    const res = await route.POST(post({ email: "a@example.com" }));
    expect(res.status).toBe(400);
  });
});
