/**
 * The bulk grant's boundary: what is refused before anything is written, and
 * that once writing starts, one address never stops the rest.
 *
 * `provisionAccess` is mocked, as in accessRoutes.test.ts — it has its own
 * tests against the fake database. What matters here is the order (validate
 * everything, ask about the course once, then grant line by line), what each
 * line is told, and that nothing about a bulk seat — money, a role — differs
 * from a single gift.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const session = { value: null as null | { user: { id: string }; role: string } };

vi.mock("@/lib/auth/requireAdmin", () => ({
  requireAdmin: async () => session.value,
}));

class AccessError extends Error {
  constructor(
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "AccessError";
  }
}

const access = {
  provisionAccess: vi.fn(),
  assertCourseGrantable: vi.fn(),
};

vi.mock("@/lib/admin/access", async () => {
  const actual = await vi.importActual<typeof import("@/lib/admin/access")>("@/lib/admin/access");
  return { ...actual, ...access, AccessError };
});

/* `withRoute` maps a thrown error to a status by `instanceof AccessError`, and
   it imports the class from the same module — so the mock above is the class
   it sees, and a course refusal keeps its own status. */
const bulk = await import("@/app/api/admin/access/learners/bulk/route");
const post = (body: unknown) =>
  bulk.POST(
    new NextRequest("http://x/api/admin/access/learners/bulk", {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({}) },
  );

const ADMIN = { user: { id: "auth-admin" }, role: "admin" };
const SUPPORT = { user: { id: "auth-support" }, role: "support" };

function granted(email: string, created = true, accountCreated = false) {
  return {
    accountCreated,
    payment: null,
    account: { email },
    grant: {
      created,
      enrollmentId: `enr-${email}`,
      expiresAt: null,
      course: { slug: "way21", title: "Шлях 21", status: "published" },
    },
  };
}

beforeEach(() => {
  session.value = ADMIN;
  for (const fn of Object.values(access)) fn.mockReset();
  access.assertCourseGrantable.mockResolvedValue({ title: "Шлях 21" });
  access.provisionAccess.mockImplementation(async (input: { email: string }) => granted(input.email));
});

describe("who may run it", () => {
  it("refuses without an admin session, before reading the course or granting anything", async () => {
    session.value = null;
    const res = await post({ emails: "a@b.co", course: "way21" });
    expect(res.status).toBe(401);
    expect(access.assertCourseGrantable).not.toHaveBeenCalled();
    expect(access.provisionAccess).not.toHaveBeenCalled();
  });

  it("lets support hand out a course to a list, as it may one at a time", async () => {
    session.value = SUPPORT;
    const res = await post({ emails: "a@b.co", course: "way21" });
    expect(res.status).toBe(200);
    expect(access.provisionAccess).toHaveBeenCalledWith(expect.objectContaining({ actorId: "auth-support" }));
  });
});

describe("validation, all before the first write", () => {
  it("names every address that is not one, and grants nobody", async () => {
    const res = await post({ emails: "ok@b.co\nnot-an-address\nanna@\nok2@b.co", course: "way21" });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "emails_invalid", invalid: ["not-an-address", "anna@"] });
    expect(access.assertCourseGrantable).not.toHaveBeenCalled();
    expect(access.provisionAccess).not.toHaveBeenCalled();
  });

  it("refuses an empty list, a missing course and a list over the cap", async () => {
    const over = Array.from({ length: 201 }, (_, i) => `p${i}@b.co`);
    const responses = await Promise.all([
      post({ emails: " \n ,", course: "way21" }),
      post({ emails: "a@b.co" }),
      post({ emails: over, course: "way21" }),
      post("{not json"),
    ]);
    const bodies = await Promise.all(responses.map((res: Response) => res.json()));
    expect(responses.map((res: Response) => res.status)).toEqual([400, 400, 400, 400]);
    expect(bodies.map((body: { error: string }) => body.error)).toEqual([
      "emails_required",
      "course_required",
      "emails_too_many",
      "invalid_json",
    ]);
    expect(bodies[2]).toMatchObject({ limit: 200, count: 201 });
    expect(access.provisionAccess).not.toHaveBeenCalled();
  });

  it("refuses money and roles outright rather than ignoring them", async () => {
    const responses = await Promise.all([
      post({ emails: "a@b.co", course: "way21", payment: { amount: 100, currency: "UAH" } }),
      post({ emails: "a@b.co", course: "way21", role: "admin" }),
    ]);
    const bodies = await Promise.all(responses.map((res: Response) => res.json()));
    expect(bodies.map((body: { error: string }) => body.error)).toEqual([
      "bulk_payment_not_allowed",
      "bulk_role_not_allowed",
    ]);
    expect(access.provisionAccess).not.toHaveBeenCalled();
  });

  it("refuses a bad date, a bad tag and an unknown reason", async () => {
    const responses = await Promise.all([
      post({ emails: "a@b.co", course: "way21", cohortStartsOn: "first of November" }),
      post({ emails: "a@b.co", course: "way21", ref: "Олена К" }),
      post({ emails: "a@b.co", course: "way21", source: "order" }),
      post({ emails: "a@b.co", course: "way21", expiresAt: "someday" }),
    ]);
    const bodies = await Promise.all(responses.map((res: Response) => res.json()));
    expect(bodies.map((body: { error: string }) => body.error)).toEqual([
      "cohort_date_invalid",
      "ref_invalid",
      "source_invalid",
      "expires_at_invalid",
    ]);
    expect(access.provisionAccess).not.toHaveBeenCalled();
  });

  it("asks about the course once, and a draft course stops the list before any account is made", async () => {
    access.assertCourseGrantable.mockRejectedValue(new AccessError("course_not_published", 409));
    const res = await post({ emails: "a@b.co\nc@d.co", course: "draft", createAccount: true });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("course_not_published");
    expect(access.assertCourseGrantable).toHaveBeenCalledTimes(1);
    expect(access.provisionAccess).not.toHaveBeenCalled();
  });
});

describe("granting", () => {
  it("dedupes and lower-cases the list, and grants each address once as a gift with no money", async () => {
    const res = await post({
      emails: "Anna@Example.com, anna@example.com\n<taras@example.com>; ANNA@example.com",
      course: "way21",
      cohortStartsOn: "2026-11-01",
      ref: "Olena",
    });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(access.provisionAccess).toHaveBeenCalledTimes(2);
    const calls = access.provisionAccess.mock.calls.map(([input]) => input);
    expect(calls.map((input) => input.email)).toEqual(["anna@example.com", "taras@example.com"]);
    for (const input of calls) {
      expect(input).toEqual({
        email: input.email,
        courseSlug: "way21",
        // Not sent → left to the offer, which with no payment means no deadline.
        expiresAt: undefined,
        source: "bonus",
        createAccount: false,
        payment: null,
        cohortStartsOn: "2026-11-01",
        ref: "olena",
        actorId: "auth-admin",
      });
      expect(input).not.toHaveProperty("role");
    }
    expect(body).toMatchObject({ source: "bonus", cohortStartsOn: "2026-11-01", duplicates: 2 });
    expect(body.summary).toEqual({ total: 2, created: 2, already: 0, failed: 0, accountsCreated: 0 });
  });

  it("keeps going past a failing address and says what happened to each, in the order pasted", async () => {
    access.provisionAccess.mockImplementation(async (input: { email: string }) => {
      if (input.email === "blocked@b.co") throw new AccessError("enrollment_blocked", 409);
      if (input.email === "ghost@b.co") throw new AccessError("account_not_found");
      if (input.email === "boom@b.co") throw new Error("relation lms_enrollments does not exist");
      if (input.email === "had@b.co") return granted(input.email, false);
      if (input.email === "new@b.co") return granted(input.email, true, true);
      return granted(input.email);
    });

    const res = await post({
      emails: ["blocked@b.co", "ok@b.co", "ghost@b.co", "boom@b.co", "had@b.co", "new@b.co"],
      course: "way21",
      source: "promotion",
      createAccount: true,
    });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(access.provisionAccess).toHaveBeenCalledTimes(6);
    expect(access.provisionAccess).toHaveBeenCalledWith(
      expect.objectContaining({ source: "promotion", createAccount: true }),
    );
    expect(body.results).toEqual([
      {
        email: "blocked@b.co",
        outcome: "error",
        accountCreated: false,
        enrollmentId: null,
        error: "enrollment_blocked",
      },
      { email: "ok@b.co", outcome: "created", accountCreated: false, enrollmentId: "enr-ok@b.co", error: null },
      { email: "ghost@b.co", outcome: "error", accountCreated: false, enrollmentId: null, error: "account_not_found" },
      // A database message names tables; the panel gets a code instead.
      { email: "boom@b.co", outcome: "error", accountCreated: false, enrollmentId: null, error: "grant_failed" },
      { email: "had@b.co", outcome: "already", accountCreated: false, enrollmentId: "enr-had@b.co", error: null },
      { email: "new@b.co", outcome: "created", accountCreated: true, enrollmentId: "enr-new@b.co", error: null },
    ]);
    expect(body.summary).toEqual({ total: 6, created: 2, already: 1, failed: 3, accountsCreated: 1 });
  });

  it("passes an explicit 'no deadline' and an empty cohort through as the single grant does", async () => {
    await post({ emails: "a@b.co", course: "way21", expiresAt: null, cohortStartsOn: "" });
    expect(access.provisionAccess).toHaveBeenCalledWith(
      expect.objectContaining({ expiresAt: null, cohortStartsOn: null }),
    );
  });
});
