/**
 * The stream chat and the channel, handed out by the support bot (G 15.10):
 * the link goes only to the CURRENT stream's buyers, one person per link, and
 * the channel is offered only to someone not in it yet.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { FakeSupabase } from "@/lib/admin/fakeSupabase";

const api = vi.hoisted(() => ({
  calls: [] as Array<{ method: string; params: Record<string, unknown> }>,
  answer: {} as Record<string, unknown>,
}));

vi.mock("server-only", () => ({}));
vi.mock("./tg", () => ({
  callTelegramBotApi: vi.fn(async (method: string, params: Record<string, unknown>) => {
    api.calls.push({ method, params });
    const answer = api.answer[method];
    if (answer instanceof Error) throw answer;
    return typeof answer === "function" ? (answer as (p: Record<string, unknown>) => unknown)(params) : answer;
  }),
}));
const started = vi.hoisted(() => ({ emails: new Set<string>() }));
vi.mock("@/lib/email/lifecycleRuns", () => ({ startedEarlier: async () => started.emails }));

const { channelButton, connectStreamChat, personalInvite, pickStream, statusIsIn, streamChatFor } =
  await import("./streamChat");
const { inGroup, isConnectCommand } = await import("./tgSupportBot");

const db = new FakeSupabase();

beforeEach(() => {
  api.calls = [];
  api.answer = {};
  started.emails = new Set();
  db.failures = {};
  db.tables = {
    customers: [{ id: "cu-1", email: "Olena@Example.com", auth_user_id: "auth-1", tg_id: "77" }],
    experience_offers: [
      {
        id: "o-old",
        experience_id: "exp-way21",
        format: "group",
        cohort_starts_on: "2026-09-01",
        stream_chat_id: -1001,
      },
      {
        id: "o-new",
        experience_id: "exp-way21",
        format: "group",
        cohort_starts_on: "2026-11-01",
        stream_chat_id: -1002,
      },
      {
        id: "o-yoga",
        experience_id: "exp-yoga",
        format: "group",
        cohort_starts_on: "2026-11-01",
        stream_chat_id: -1009,
      },
      { id: "o-self", experience_id: "exp-way21", format: "self", cohort_starts_on: null, stream_chat_id: null },
    ],
    lms_courses: [
      { id: "c-way21", experience_id: "exp-way21" },
      { id: "c-yoga", experience_id: "exp-yoga" },
    ],
    orders: [],
    lms_enrollments: [],
    telegram_stream_chats: [],
  };
});

describe("membership", () => {
  it("counts creator, admin, member and a restricted member still in", () => {
    for (const status of ["creator", "administrator", "member", "restricted"]) expect(statusIsIn(status)).toBe(true);
    for (const status of ["left", "kicked", undefined, null]) expect(statusIsIn(status)).toBe(false);
  });

  it("offers the channel only to someone not in it, and when the bot cannot tell", async () => {
    api.answer.getChatMember = { status: "member" };
    expect(await channelButton(5)).toBeNull();
    api.answer.getChatMember = { status: "left" };
    expect(await channelButton(5)).toEqual({ text: "Канал CenterWay", url: "https://t.me/cway_flow" });
    api.answer.getChatMember = new Error("bot is not a member");
    expect(await channelButton(5)).not.toBeNull();
  });
});

describe("personalInvite", () => {
  it("creates a one-person link that expires in a week", async () => {
    api.answer.getChatMember = { status: "left" };
    api.answer.createChatInviteLink = { invite_link: "https://t.me/+abc" };
    const now = Date.parse("2026-10-15T10:00:00Z");
    expect(
      await personalInvite({ chatId: -1002, userId: 5, name: "Олена Петренко з дуже довгим прізвищем", now }),
    ).toEqual({
      url: "https://t.me/+abc",
    });
    const create = api.calls.find((call) => call.method === "createChatInviteLink")!;
    expect(create.params).toMatchObject({ chat_id: -1002, member_limit: 1, expire_date: now / 1000 + 7 * 24 * 3600 });
    expect(String(create.params.name).length).toBeLessThanOrEqual(32);
  });

  it("does not make a link for someone already inside, and says null when the bot may not invite", async () => {
    api.answer.getChatMember = { status: "member" };
    expect(await personalInvite({ chatId: -1002, userId: 5, name: "О" })).toEqual({ already: true });
    expect(api.calls.some((call) => call.method === "createChatInviteLink")).toBe(false);
    api.answer.getChatMember = { status: "left" };
    api.answer.createChatInviteLink = new Error("not enough rights");
    expect(await personalInvite({ chatId: -1002, userId: 5, name: "О" })).toBeNull();
  });
});

describe("which stream's chat", () => {
  it("picks the latest start", () => {
    expect(
      pickStream([
        { offerId: "a", chatId: 1, cohortStartsOn: "2026-09-01" },
        { offerId: "b", chatId: 2, cohortStartsOn: "2026-11-01" },
      ]),
    ).toMatchObject({ offerId: "b" });
    expect(pickStream([])).toBeNull();
  });

  it("finds the chat through a paid order of a group format", async () => {
    db.tables.orders = [{ id: "ord", customer_id: "cu-1", offer_id: "o-new", status: "paid" }];
    expect(await streamChatFor(db as never, "77")).toEqual({
      offerId: "o-new",
      chatId: -1002,
      cohortStartsOn: "2026-11-01",
    });
  });

  it("does not open the new stream's chat to last season's buyer of the same offer", async () => {
    db.tables.orders = [{ id: "ord", customer_id: "cu-1", offer_id: "o-new", status: "paid" }];
    started.emails = new Set(["olena@example.com"]);
    expect(await streamChatFor(db as never, "77")).toBeNull();
  });

  it("finds the chat through a granted seat, and ignores unpaid orders and strangers", async () => {
    db.tables.orders = [{ id: "ord", customer_id: "cu-1", offer_id: "o-old", status: "pending" }];
    expect(await streamChatFor(db as never, "77")).toBeNull();
    db.tables.lms_enrollments = [
      { auth_user_id: "auth-1", course_id: "c-way21", status: "active", cohort_starts_on: "2026-09-01" },
    ];
    expect(await streamChatFor(db as never, "77")).toMatchObject({ chatId: -1001 });
    expect(await streamChatFor(db as never, "999")).toBeNull();
  });

  it("opens a seat's own program's stream, never another program starting the same day", async () => {
    db.tables.lms_enrollments = [
      { auth_user_id: "auth-1", course_id: "c-yoga", status: "active", cohort_starts_on: "2026-11-01" },
    ];
    expect(await streamChatFor(db as never, "77")).toEqual({
      offerId: "o-yoga",
      chatId: -1009,
      cohortStartsOn: "2026-11-01",
    });
  });
});

describe("/connect", () => {
  it("listens in a group only for /connect, bare or addressed to this bot", () => {
    expect(inGroup("supergroup")).toBe(true);
    expect(inGroup("private")).toBe(false);
    expect(inGroup(undefined)).toBe(false);
    expect(isConnectCommand("/connect")).toBe(true);
    expect(isConnectCommand("/connect@centerway_support_bot")).toBe(true);
    expect(isConnectCommand("/connect@other_bot")).toBe(false);
    expect(isConnectCommand("/connect please")).toBe(false);
    expect(isConnectCommand("привіт")).toBe(false);
  });

  it("refuses a member who is not an admin of the group", async () => {
    api.answer.getChatMember = { status: "member" };
    api.answer.getMe = { id: 1 };
    expect(await connectStreamChat(db as never, { id: -1003, title: "Потік XII" }, 5)).toContain(
      "тільки адміністратор",
    );
    expect(db.rows("telegram_stream_chats")).toHaveLength(0);
  });

  it("records the group, and says when the bot still cannot invite", async () => {
    api.answer.getMe = { id: 1 };
    api.answer.getChatMember = (params: Record<string, unknown>) =>
      params.user_id === 1 ? { status: "administrator", can_invite_users: false } : { status: "creator" };
    expect(await connectStreamChat(db as never, { id: -1003, title: "Потік XII" }, 5)).toContain("не можу запрошувати");
    expect(db.rows("telegram_stream_chats")[0]).toMatchObject({ chat_id: -1003, bot_can_invite: false });

    api.answer.getChatMember = (params: Record<string, unknown>) =>
      params.user_id === 1 ? { status: "administrator", can_invite_users: true } : { status: "administrator" };
    expect(await connectStreamChat(db as never, { id: -1003, title: "Потік XII" }, 5)).toContain("Чат підключено");
    expect(db.rows("telegram_stream_chats")).toHaveLength(1);
    expect(db.rows("telegram_stream_chats")[0]).toMatchObject({ bot_can_invite: true });
  });
});
