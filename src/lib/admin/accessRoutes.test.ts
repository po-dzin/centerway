/**
 * The access API's boundary: who gets in, who is refused, and what an error
 * turns into on the wire.
 *
 * The handlers themselves are thin, which is the point — the thing worth
 * testing is that `support` can hand out a course but not a role, that an
 * unauthenticated call never reaches the module at all, and that an
 * `AccessError` keeps its status instead of collapsing into a 500.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const session = { value: null as null | { user: { id: string }; role: string } };

vi.mock("@/lib/auth/requireAdmin", () => ({
    requireAdmin: async () => session.value,
}));

const access = {
    listLearners: vi.fn(),
    listAccounts: vi.fn(),
    provisionAccess: vi.fn(),
    setEnrollmentDeadline: vi.fn(),
    revokeCourse: vi.fn(),
    listRoles: vi.fn(),
    setRole: vi.fn(),
    listCourses: vi.fn(),
    setCourseAuthor: vi.fn(),
};

class AccessError extends Error {
    constructor(message: string, readonly status: number = 400) {
        super(message);
        this.name = "AccessError";
    }
}

vi.mock("@/lib/admin/access", async () => {
    const actual = await vi.importActual<typeof import("@/lib/admin/access")>("@/lib/admin/access");
    return { ...actual, ...access, AccessError };
});

const learners = await import("@/app/api/admin/access/learners/route");
const accounts = await import("@/app/api/admin/access/accounts/route");
const roles = await import("@/app/api/admin/access/roles/route");
const courses = await import("@/app/api/admin/access/courses/route");

const ADMIN = { user: { id: "auth-admin" }, role: "admin" };
const SUPPORT = { user: { id: "auth-support" }, role: "support" };

function get(url: string) {
    return new NextRequest(url);
}

function send(url: string, method: "POST" | "DELETE" | "PATCH", body?: unknown) {
    return new NextRequest(url, {
        method,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
}

beforeEach(() => {
    session.value = ADMIN;
    for (const fn of Object.values(access)) fn.mockReset();
    access.listLearners.mockResolvedValue({ items: [], total: 0, truncated: false, summary: {} });
    access.listAccounts.mockResolvedValue({ items: [], total: 0 });
    access.listRoles.mockResolvedValue([]);
    access.listCourses.mockResolvedValue([]);
});

describe("authentication", () => {
    it("refuses every endpoint without an admin session, without touching the data", async () => {
        session.value = null;

        const responses = await Promise.all([
            learners.GET(get("http://x/api/admin/access/learners")),
            learners.POST(send("http://x/api/admin/access/learners", "POST", { email: "a@b.c", course: "reset-day" })),
            learners.DELETE(send("http://x/api/admin/access/learners?enrollmentId=e1", "DELETE")),
            learners.PATCH(send("http://x/api/admin/access/learners", "PATCH", { enrollmentId: "e1", expiresAt: "2026-09-30" })),
            accounts.GET(get("http://x/api/admin/access/accounts")),
            roles.GET(get("http://x/api/admin/access/roles")),
            roles.POST(send("http://x/api/admin/access/roles", "POST", { email: "a@b.c", role: "admin" })),
            courses.GET(get("http://x/api/admin/access/courses")),
            courses.PATCH(send("http://x/api/admin/access/courses", "PATCH", { courseId: "c1" })),
        ]);

        expect(responses.map((res) => res.status)).toEqual([401, 401, 401, 401, 401, 401, 401, 401, 401]);
        for (const fn of Object.values(access)) expect(fn).not.toHaveBeenCalled();
    });
});

describe("learners", () => {
    it("passes filters through and reports the caps it applied", async () => {
        await learners.GET(get("http://x/api/admin/access/learners?q=ann&course=reset-day&status=stalled&limit=10&offset=20"));
        expect(access.listLearners).toHaveBeenCalledWith({
            q: "ann",
            courseSlug: "reset-day",
            status: "stalled",
            limit: 10,
            offset: 20,
        });
    });

    it("drops a status it does not know rather than filtering on nonsense", async () => {
        await learners.GET(get("http://x/api/admin/access/learners?status=vip"));
        expect(access.listLearners).toHaveBeenCalledWith(expect.objectContaining({ status: "" }));
    });

    it("falls back to a sane page when limit/offset are not numbers", async () => {
        await learners.GET(get("http://x/api/admin/access/learners?limit=abc&offset=-5"));
        expect(access.listLearners).toHaveBeenCalledWith(expect.objectContaining({ limit: 50, offset: 0 }));
    });

    it("lets support grant and revoke course access", async () => {
        session.value = SUPPORT;
        access.provisionAccess.mockResolvedValue({
            accountCreated: false,
            payment: null,
            account: { email: "a@b.c" },
            grant: {
                created: true,
                enrollmentId: "enr-9",
                expiresAt: null,
                course: { slug: "reset-day", title: "Reset Day", status: "published" },
            },
        });
        access.revokeCourse.mockResolvedValue({ courseSlug: "reset-day", email: "a@b.c", progressEventsDeleted: 3 });

        const granted = await learners.POST(send("http://x/api/admin/access/learners", "POST", { email: "a@b.c", course: "reset-day" }));
        expect(granted.status).toBe(200);
        expect(await granted.json()).toMatchObject({ created: true, enrollmentId: "enr-9" });
        expect(access.provisionAccess).toHaveBeenCalledWith({
            email: "a@b.c",
            fullName: null,
            courseSlug: "reset-day",
            expiresAt: null,
            createAccount: false,
            payment: null,
            actorId: "auth-support",
        });

        const revoked = await learners.DELETE(send("http://x/api/admin/access/learners?enrollmentId=enr-9", "DELETE"));
        expect(revoked.status).toBe(200);
        expect(access.revokeCourse).toHaveBeenCalledWith({ enrollmentId: "enr-9", actorId: "auth-support" });
    });

    it("carries a deadline, an account request and a payment through to the module", async () => {
        access.provisionAccess.mockResolvedValue({
            accountCreated: true,
            payment: { orderRef: "manual_course-reset-day_20260826_abc" },
            account: { email: "new@b.c" },
            grant: {
                created: true,
                enrollmentId: "enr-10",
                expiresAt: "2026-09-30T23:59:59.999Z",
                course: { slug: "reset-day", title: "Reset Day", status: "published" },
            },
        });

        const res = await learners.POST(
            send("http://x/api/admin/access/learners", "POST", {
                email: "new@b.c",
                course: "reset-day",
                fullName: "Ann",
                createAccount: true,
                expiresAt: "2026-09-30",
                payment: { amount: "1200", currency: "UAH", note: "bank transfer" },
            })
        );

        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({
            created: true,
            accountCreated: true,
            orderRef: "manual_course-reset-day_20260826_abc",
            expiresAt: "2026-09-30T23:59:59.999Z",
        });
        expect(access.provisionAccess).toHaveBeenCalledWith({
            email: "new@b.c",
            fullName: "Ann",
            courseSlug: "reset-day",
            // A bare date is stored as the END of that day: access "until the
            // 30th" must include the 30th.
            expiresAt: "2026-09-30T23:59:59.999Z",
            createAccount: true,
            payment: { amount: 1200, currency: "UAH", note: "bank transfer" },
            actorId: "auth-admin",
        });
    });

    it("refuses a half-typed payment rather than granting access without the order", async () => {
        const badAmount = await learners.POST(
            send("http://x/api/admin/access/learners", "POST", {
                email: "a@b.c",
                course: "reset-day",
                payment: { amount: "-5", currency: "UAH" },
            })
        );
        expect(badAmount.status).toBe(400);
        expect(await badAmount.json()).toEqual({ error: "amount_invalid" });

        const badCurrency = await learners.POST(
            send("http://x/api/admin/access/learners", "POST", {
                email: "a@b.c",
                course: "reset-day",
                payment: { amount: "100", currency: "BTC" },
            })
        );
        expect(badCurrency.status).toBe(400);

        const badDate = await learners.POST(
            send("http://x/api/admin/access/learners", "POST", { email: "a@b.c", course: "reset-day", expiresAt: "soon" })
        );
        expect(badDate.status).toBe(400);
        expect(await badDate.json()).toEqual({ error: "expires_at_invalid" });

        expect(access.provisionAccess).not.toHaveBeenCalled();
    });

    it("sets and clears a deadline on one enrollment", async () => {
        access.setEnrollmentDeadline.mockResolvedValue({ enrollmentId: "enr-9", expiresAt: null });

        const cleared = await learners.PATCH(
            send("http://x/api/admin/access/learners", "PATCH", { enrollmentId: "enr-9", expiresAt: "" })
        );
        expect(cleared.status).toBe(200);
        expect(access.setEnrollmentDeadline).toHaveBeenCalledWith({
            enrollmentId: "enr-9",
            expiresAt: null,
            actorId: "auth-admin",
        });

        const noTarget = await learners.PATCH(send("http://x/api/admin/access/learners", "PATCH", { expiresAt: "2026-09-30" }));
        expect(noTarget.status).toBe(400);
    });

    it("rejects an incomplete grant and a revoke with no target", async () => {
        const noCourse = await learners.POST(send("http://x/api/admin/access/learners", "POST", { email: "a@b.c" }));
        expect(noCourse.status).toBe(400);

        const noTarget = await learners.DELETE(send("http://x/api/admin/access/learners", "DELETE"));
        expect(noTarget.status).toBe(400);

        expect(access.provisionAccess).not.toHaveBeenCalled();
        expect(access.revokeCourse).not.toHaveBeenCalled();
    });

    it("keeps an AccessError's own status instead of turning it into a 500", async () => {
        access.provisionAccess.mockRejectedValue(new AccessError("account_not_found", 400));
        const res = await learners.POST(send("http://x/api/admin/access/learners", "POST", { email: "ghost@b.c", course: "reset-day" }));
        expect(res.status).toBe(400);
        expect(await res.json()).toEqual({ error: "account_not_found" });

        access.provisionAccess.mockRejectedValue(new AccessError("course_not_found", 404));
        expect((await learners.POST(send("http://x/api/admin/access/learners", "POST", { email: "a@b.c", course: "nope" }))).status).toBe(404);
    });

    it("reports an unexpected failure as a 500", async () => {
        access.listLearners.mockRejectedValue(new Error("connection reset"));
        const res = await learners.GET(get("http://x/api/admin/access/learners"));
        expect(res.status).toBe(500);
    });
});

describe("accounts", () => {
    it("pages the account list and tells the UI whether roles may be changed", async () => {
        session.value = SUPPORT;
        const res = await accounts.GET(get("http://x/api/admin/access/accounts?q=ann&limit=10&offset=20"));

        expect(res.status).toBe(200);
        expect(access.listAccounts).toHaveBeenCalledWith({ q: "ann", limit: 10, offset: 20 });
        // `support` reads this list but may not hand out roles from it.
        expect(await res.json()).toMatchObject({ canGrant: false, selfId: "auth-support" });
    });

    it("falls back to a sane page when limit/offset are not numbers", async () => {
        await accounts.GET(get("http://x/api/admin/access/accounts?limit=abc&offset=-5"));
        expect(access.listAccounts).toHaveBeenCalledWith(expect.objectContaining({ limit: 50, offset: 0 }));
    });
});

describe("roles", () => {
    it("lets support read the role map but tells the UI it may not grant", async () => {
        session.value = SUPPORT;
        const res = await roles.GET(get("http://x/api/admin/access/roles"));
        expect(res.status).toBe(200);
        expect(await res.json()).toMatchObject({ canGrant: false });
    });

    it("marks an admin as able to grant", async () => {
        expect(await (await roles.GET(get("http://x/api/admin/access/roles"))).json()).toMatchObject({ canGrant: true });
    });

    it("refuses a role change from support — reading is not granting", async () => {
        session.value = SUPPORT;
        const res = await roles.POST(send("http://x/api/admin/access/roles", "POST", { email: "a@b.c", role: "admin" }));
        expect(res.status).toBe(403);
        expect(access.setRole).not.toHaveBeenCalled();
    });

    it("refuses a role the role store would not accept", async () => {
        for (const role of ["owner", "Admin", "", undefined]) {
            const res = await roles.POST(send("http://x/api/admin/access/roles", "POST", { email: "a@b.c", role }));
            expect(res.status).toBe(400);
        }
        expect(access.setRole).not.toHaveBeenCalled();
    });

    it("assigns a valid role as the acting admin", async () => {
        access.setRole.mockResolvedValue({ account: { email: "a@b.c" }, previous: "user", role: "coach" });
        const res = await roles.POST(send("http://x/api/admin/access/roles", "POST", { email: "a@b.c", role: "coach" }));
        expect(res.status).toBe(200);
        expect(access.setRole).toHaveBeenCalledWith({ email: "a@b.c", role: "coach", actorId: "auth-admin" });
    });

    it("passes the self-demotion refusal through as a 409", async () => {
        access.setRole.mockRejectedValue(new AccessError("cannot_change_own_role", 409));
        const res = await roles.POST(send("http://x/api/admin/access/roles", "POST", { email: "admin@b.c", role: "user" }));
        expect(res.status).toBe(409);
    });
});

describe("courses", () => {
    it("refuses an authorship change from support", async () => {
        session.value = SUPPORT;
        const res = await courses.PATCH(send("http://x/api/admin/access/courses", "PATCH", { courseId: "c1", email: "a@b.c" }));
        expect(res.status).toBe(403);
        expect(access.setCourseAuthor).not.toHaveBeenCalled();
    });

    it("requires a course to act on", async () => {
        const res = await courses.PATCH(send("http://x/api/admin/access/courses", "PATCH", { email: "a@b.c" }));
        expect(res.status).toBe(400);
    });

    it("assigns an author, trimming the email", async () => {
        access.setCourseAuthor.mockResolvedValue({ course: { id: "c1", slug: "reset-day" }, account: { email: "a@b.c" } });
        await courses.PATCH(send("http://x/api/admin/access/courses", "PATCH", { courseId: "c1", email: "  a@b.c  " }));
        expect(access.setCourseAuthor).toHaveBeenCalledWith({ courseId: "c1", email: "a@b.c", actorId: "auth-admin" });
    });

    it("reads a blank email as 'return it to the house', not as a missing field", async () => {
        access.setCourseAuthor.mockResolvedValue({ course: { id: "c1", slug: "reset-day" }, account: null });
        const res = await courses.PATCH(send("http://x/api/admin/access/courses", "PATCH", { courseId: "c1", email: "   " }));
        expect(res.status).toBe(200);
        expect(access.setCourseAuthor).toHaveBeenCalledWith({ courseId: "c1", email: null, actorId: "auth-admin" });
        expect(await res.json()).toMatchObject({ author: null });
    });
});
