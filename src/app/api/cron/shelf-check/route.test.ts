/**
 * The watch's own wiring: who may call it, and when it speaks.
 *
 * Both properties are the ones a manual test cannot check safely — the second
 * one sends a real Telegram message — and both are the ones that decide whether
 * the alarm is worth having. A watcher that reports every day is dismissed by
 * habit; a watcher anyone can trigger is a way to make it dismissed on purpose.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Typed like the real sender, so the assertion below can read the text argument
// rather than index into an untyped tuple.
const sendTelegramMessage =
    vi.fn<(chatId: number | string, text: string, options?: { messageThreadId?: number | null }) => Promise<void>>(
        async () => undefined
    );
const auditShelf = vi.fn();

vi.mock("@/lib/tg", () => ({ sendTelegramMessage }));
vi.mock("@/lib/lms/shelfHealth", async () => {
    const actual = await vi.importActual<typeof import("@/lib/lms/shelfHealth")>("@/lib/lms/shelfHealth");
    return { ...actual, auditShelf };
});

const { GET } = await import("./route");

const SECRET = "cron-secret";

const call = (token?: string) =>
    GET(new Request("https://example.test/api/cron/shelf-check", {
        headers: token ? { authorization: `Bearer ${token}` } : {},
    }));

beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
    process.env.SUPPORT_CHAT_ID = "-100123";
    sendTelegramMessage.mockClear();
    auditShelf.mockReset();
});

afterEach(() => {
    delete process.env.SUPPORT_CHAT_ID;
});

describe("GET /api/cron/shelf-check", () => {
    it("refuses a caller without the cron secret, and says nothing to anyone", async () => {
        auditShelf.mockResolvedValue({ checkedAt: "now", courses: 1, faults: [] });

        expect((await call()).status).toBe(401);
        expect((await call("wrong")).status).toBe(401);
        expect(auditShelf).not.toHaveBeenCalled();
        expect(sendTelegramMessage).not.toHaveBeenCalled();
    });

    it("stays silent on a healthy shelf", async () => {
        auditShelf.mockResolvedValue({ checkedAt: "now", courses: 9, faults: [] });

        const response = await call(SECRET);

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({ success: true, reported: "not_needed", courses: 9 });
        expect(sendTelegramMessage).not.toHaveBeenCalled();
    });

    it("reports a missing course, naming it", async () => {
        auditShelf.mockResolvedValue({
            checkedAt: "now",
            courses: 9,
            faults: [{ slug: "reset-day", title: "Reset Day", kind: "unrenderable", detail: "lms_course_title_too_long:db" }],
        });

        const response = await call(SECRET);

        await expect(response.json()).resolves.toMatchObject({ success: true, reported: "sent" });
        expect(sendTelegramMessage).toHaveBeenCalledTimes(1);
        expect(sendTelegramMessage.mock.calls[0][1]).toContain("reset-day");
    });

    it("does not die of its own alarm when Telegram refuses", async () => {
        auditShelf.mockResolvedValue({
            checkedAt: "now",
            courses: 9,
            faults: [{ slug: "reset-day", title: "Reset Day", kind: "unrenderable", detail: "x" }],
        });
        sendTelegramMessage.mockRejectedValueOnce(new Error("telegram down"));

        const response = await call(SECRET);

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({ reported: "failed" });
    });

    it("reports the audit itself failing, rather than returning a clean 500", async () => {
        auditShelf.mockRejectedValue(new Error("lms_shelf_audit_read_failed:boom"));

        const response = await call(SECRET);

        expect(response.status).toBe(500);
        expect(sendTelegramMessage).toHaveBeenCalledTimes(1);
    });
});
