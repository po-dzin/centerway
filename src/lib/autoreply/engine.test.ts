import { describe, expect, it, vi } from "vitest";

import { buildLink, composeDirectMessage, handleComment, type AutoreplyRule, type AutoreplyStore } from "./engine";
import type { CommentEvent, InstagramSender } from "./instagram";

const ORIGIN = "https://www.centerway.net.ua";
const NOW = 1_790_000_000_000;

const rule = (over: Partial<AutoreplyRule> = {}): AutoreplyRule => ({
  id: "r1",
  name: "ДОША під постом",
  mediaId: "M1",
  keywords: ["доша"],
  publicReplies: ["Перевірте приватні повідомлення 💬"],
  dmTexts: ["Дякуємо! Ось тест."],
  buttonLabel: "Пройти тест",
  buttonUrl: "/tests/dosha",
  utmCampaign: "dosha-post",
  enabled: true,
  maxPerHour: 200,
  ...over,
});

const comment = (over: Partial<CommentEvent> = {}): CommentEvent => ({
  commentId: "c1",
  mediaId: "M1",
  text: "Доша!",
  fromId: "U1",
  fromUsername: "anna",
  time: NOW / 1000 - 60,
  ...over,
});

function setup(
  opts: {
    rules?: AutoreplyRule[];
    claimed?: boolean;
    earlierClaim?: boolean;
    claimsLastHour?: number;
    sender?: InstagramSender | null;
  } = {},
) {
  const finished: { id: string; status: string; error?: string }[] = [];
  const store: AutoreplyStore = {
    listEnabledRules: async () => opts.rules ?? [rule()],
    claimComment: async () => (opts.claimed === false ? null : "e1"),
    hasEarlierClaim: async () => opts.earlierClaim ?? false,
    countClaimsSince: async () => opts.claimsLastHour ?? 1,
    finish: async (id, status, error) => void finished.push({ id, status, error }),
  };
  const sender: InstagramSender = { sendPrivateReply: vi.fn(async () => {}), replyPublicly: vi.fn(async () => {}) };
  const deps = {
    store,
    sender: opts.sender === undefined ? sender : opts.sender,
    siteOrigin: ORIGIN,
    now: () => NOW,
    random: () => 0,
  };
  return { deps, sender, finished };
}

describe("handleComment", () => {
  it("sends the direct message with the tagged link, then the public reply", async () => {
    const { deps, sender, finished } = setup();
    expect(await handleComment(comment(), deps)).toEqual({ outcome: "sent", ruleId: "r1" });
    expect(sender.sendPrivateReply).toHaveBeenCalledWith(
      "c1",
      `Дякуємо! Ось тест.\n\nПройти тест: ${ORIGIN}/tests/dosha?utm_source=instagram&utm_medium=autodm&utm_campaign=dosha-post`,
    );
    expect(sender.replyPublicly).toHaveBeenCalledWith("c1", "Перевірте приватні повідомлення 💬");
    expect(finished).toEqual([{ id: "e1", status: "sent", error: undefined }]);
  });

  it("does nothing for a comment without the word or on another post", async () => {
    const a = setup();
    expect((await handleComment(comment({ text: "гарний пост" }), a.deps)).outcome).toBe("no_rule");
    const b = setup();
    expect((await handleComment(comment({ mediaId: "M2" }), b.deps)).outcome).toBe("no_rule");
    expect(a.sender.sendPrivateReply).not.toHaveBeenCalled();
    expect(b.sender.sendPrivateReply).not.toHaveBeenCalled();
  });

  it("answers any post when the rule has no post", async () => {
    const { deps } = setup({ rules: [rule({ mediaId: null })] });
    expect((await handleComment(comment({ mediaId: "M9" }), deps)).outcome).toBe("sent");
  });

  it("does not answer a comment it already handled", async () => {
    const { deps, sender } = setup({ claimed: false });
    expect((await handleComment(comment(), deps)).outcome).toBe("already_handled");
    expect(sender.sendPrivateReply).not.toHaveBeenCalled();
  });

  it("refuses a comment older than seven days", async () => {
    const { deps, sender, finished } = setup();
    const result = await handleComment(comment({ time: NOW / 1000 - 8 * 24 * 3600 }), deps);
    expect(result.outcome).toBe("skipped_old");
    expect(sender.sendPrivateReply).not.toHaveBeenCalled();
    expect(finished[0]?.status).toBe("skipped_old");
  });

  it("sends one message per person", async () => {
    const { deps, sender } = setup({ earlierClaim: true });
    expect((await handleComment(comment(), deps)).outcome).toBe("skipped_duplicate");
    expect(sender.sendPrivateReply).not.toHaveBeenCalled();
  });

  it("sends when its own claim is the last one under the cap", async () => {
    const { deps } = setup({ claimsLastHour: 200 });
    expect((await handleComment(comment(), deps)).outcome).toBe("sent");
  });

  it("stops at the hourly cap", async () => {
    const { deps, sender } = setup({ claimsLastHour: 201 });
    expect((await handleComment(comment(), deps)).outcome).toBe("skipped_rate");
    expect(sender.sendPrivateReply).not.toHaveBeenCalled();
  });

  it("records a refusal from Instagram as a failure and sends no public reply", async () => {
    const { deps, sender, finished } = setup();
    vi.mocked(sender.sendPrivateReply).mockRejectedValueOnce(new Error("Cannot message this user"));
    expect((await handleComment(comment(), deps)).outcome).toBe("failed");
    expect(sender.replyPublicly).not.toHaveBeenCalled();
    expect(finished[0]).toEqual({ id: "e1", status: "failed", error: "Cannot message this user" });
  });

  it("still counts the reply as sent when only the public line fails", async () => {
    const { deps, sender } = setup();
    vi.mocked(sender.replyPublicly).mockRejectedValueOnce(new Error("nope"));
    expect((await handleComment(comment(), deps)).outcome).toBe("sent");
  });

  it("closes its claim as failed when a check throws, so the person is not blocked for good", async () => {
    const { deps, sender, finished } = setup();
    deps.store.hasEarlierClaim = async () => {
      throw new Error("db_down");
    };
    await expect(handleComment(comment(), deps)).rejects.toThrow("db_down");
    expect(sender.sendPrivateReply).not.toHaveBeenCalled();
    expect(finished).toEqual([{ id: "e1", status: "failed", error: "db_down" }]);
  });

  it("records not_configured while there is no access token", async () => {
    const { deps, finished } = setup({ sender: null });
    expect((await handleComment(comment(), deps)).outcome).toBe("failed");
    expect(finished[0]?.error).toBe("instagram_not_configured");
  });
});

describe("links", () => {
  it("makes a relative link absolute and tags it", () => {
    expect(buildLink("/tests/dosha", { name: "ДОША", utmCampaign: null }, ORIGIN)).toBe(
      `${ORIGIN}/tests/dosha?utm_source=instagram&utm_medium=autodm`,
    );
  });

  it("sends the bare text when the rule has no link", () => {
    expect(composeDirectMessage("Привіт", rule({ buttonUrl: null }), ORIGIN)).toBe("Привіт");
  });
});
