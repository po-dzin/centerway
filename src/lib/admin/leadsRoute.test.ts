/**
 * The lead queue's two endpoints — the gate and the stage vocabulary.
 *
 * `smoke:admin:write-guards` covers the same gate over HTTP, but only against a
 * running server: the first run of this route reported 405 purely because the
 * dev server on the smoke port was serving a build that predated it. A gate
 * that can pass for the wrong reason is not a gate, so the authorisation check
 * is asserted here too, where nothing external can be stale.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { FakeSupabase } from "./fakeSupabase";

const db = new FakeSupabase();
const session = { value: null as null | { user: { id: string }; role: string } };

vi.mock("@/lib/auth/requireAdmin", () => ({
  requireAdmin: async () => session.value,
}));

vi.mock("@/lib/auth/adminClient", () => ({
  adminClient: () => db,
}));

const leads = await import("@/app/api/admin/leads/route");
const { LEAD_STAGES, LEAD_OPEN_STAGES } = await import("@/lib/platform/leadStage");

const ADMIN = { user: { id: "auth-admin" }, role: "admin" };

function get(url = "http://localhost/api/admin/leads") {
  return new NextRequest(url, { method: "GET" });
}

function patch(body: unknown) {
  return new NextRequest("http://localhost/api/admin/leads", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  session.value = null;
});

describe("GET /api/admin/leads", () => {
  it("refuses an anonymous read", async () => {
    expect((await leads.GET(get())).status).toBe(401);
  });

  it("refuses a stage outside the vocabulary", async () => {
    session.value = ADMIN;
    const res = await leads.GET(get("http://localhost/api/admin/leads?stage=bogus"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "stage_invalid" });
  });
});

describe("PATCH /api/admin/leads", () => {
  it("refuses an anonymous write", async () => {
    expect((await leads.PATCH(patch({ id: "l1", stage: "won" }))).status).toBe(401);
  });

  it("refuses a stage the CHECK constraint would reject anyway", async () => {
    // Two guards on purpose: the database is the last word, but a route that
    // forwards junk to it turns a typo into a 500 instead of a 400.
    session.value = ADMIN;
    const res = await leads.PATCH(patch({ id: "l1", stage: "closed" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "stage_invalid" });
  });

  it("requires an id", async () => {
    session.value = ADMIN;
    const res = await leads.PATCH(patch({ stage: "won" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "id_required" });
  });
});

describe("the open/closed split", () => {
  it("names exactly the two stages a follow-up sequence may speak to", async () => {
    // If this ever disagrees with the CHECK constraint in
    // docs/migration/sql/2026-09-10_lead_stage.sql, one of them is wrong.
    /* Read from the lib, not from the route: a Next route may not export
           them at all — `next build` rejects it, which is how this was found
           after tsc, lint and every test had passed. */
    expect(LEAD_STAGES).toEqual(["new", "in_progress", "won", "lost"]);
    expect(LEAD_OPEN_STAGES).toEqual(["new", "in_progress"]);
  });
});

describe("PATCH against a hostile body", () => {
  beforeEach(() => {
    session.value = ADMIN;
  });

  it("refuses a stage that is not a string at all", async () => {
    // The body is JSON, not a form: `stage` can arrive as an array, an
    // object or a number, and `Array.includes` on a non-string simply says
    // no — this asserts that it is actually reached, not bypassed.
    for (const stage of [["won"], { toString: () => "won" }, 1, null, true]) {
      const res = await leads.PATCH(patch({ id: "l1", stage }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "stage_invalid" });
    }
  });

  it("refuses an id that is not a string", async () => {
    for (const id of [{}, ["l1"], 7, true]) {
      const res = await leads.PATCH(patch({ id, stage: "won" }));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "id_required" });
    }
  });

  it("refuses a whitespace-only id rather than filtering on nothing", async () => {
    // An `.eq("id", "")` would be a filter that matches no row, which is
    // harmless — but a blank id is a malformed request and should say so.
    const res = await leads.PATCH(patch({ id: "   ", stage: "won" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "id_required" });
  });

  it("refuses a stage smuggled in with different casing", async () => {
    // The vocabulary is exact; the CHECK constraint in the database is too,
    // and a route that accepted `WON` would turn a typo into a 500.
    const res = await leads.PATCH(patch({ id: "l1", stage: "WON" }));
    expect(res.status).toBe(400);
  });

  it("survives a body that is not JSON at all", async () => {
    const req = new NextRequest("http://localhost/api/admin/leads", {
      method: "PATCH",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await leads.PATCH(req);
    expect(res.status).toBe(400);
  });

  it("checks authorisation BEFORE it reads the body", async () => {
    // Order matters: an unauthenticated caller must not be able to reach the
    // parser, however malformed their payload.
    session.value = null;
    const req = new NextRequest("http://localhost/api/admin/leads", {
      method: "PATCH",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });
    expect((await leads.PATCH(req)).status).toBe(401);
  });
});

describe("GET against a hostile query string", () => {
  beforeEach(() => {
    session.value = ADMIN;
  });

  it("checks authorisation before it validates anything else", async () => {
    session.value = null;
    const res = await leads.GET(get("http://localhost/api/admin/leads?stage=bogus"));
    expect(res.status).toBe(401);
  });

  it("accepts every stage in the vocabulary and nothing beside it", async () => {
    for (const stage of LEAD_STAGES) {
      const res = await leads.GET(get(`http://localhost/api/admin/leads?stage=${stage}`));
      expect(res.status).toBe(200);
    }
    // An empty stage means "all stages". A stage with surrounding whitespace
    // is the same stage — the route trims before it validates, which is what
    // makes a hand-edited URL or a copied link work.
    for (const stage of ["", " won ", "\twon"]) {
      const res = await leads.GET(get(`http://localhost/api/admin/leads?stage=${encodeURIComponent(stage)}`));
      expect(res.status).toBe(200);
    }
    // Everything else is refused, including a comma that would otherwise
    // have reached the `.in()` filter as two values.
    for (const stage of ["Won", "won,lost", "*", "won'--", "new)"]) {
      const res = await leads.GET(get(`http://localhost/api/admin/leads?stage=${encodeURIComponent(stage)}`));
      expect(res.status).toBe(400);
    }
  });
});
