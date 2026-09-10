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
        expect(leads.LEAD_STAGES).toEqual(["new", "in_progress", "won", "lost"]);
        expect(leads.LEAD_OPEN_STAGES).toEqual(["new", "in_progress"]);
    });
});
