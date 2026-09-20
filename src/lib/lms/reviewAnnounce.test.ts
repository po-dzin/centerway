import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { announceReviewSubmitted, formatReviewSubmission } from "./reviewAnnounce";

const notifyHouseThread = vi.fn();
vi.mock("@/lib/telegram/houseThread", () => ({
  notifyHouseThread: (...args: unknown[]) => notifyHouseThread(...args),
}));

const submission = {
  slug: "short",
  title: "Short-Перезавантаження",
  actorEmail: "author@example.com",
  isRevision: false,
};

beforeEach(() => {
  notifyHouseThread.mockReset().mockResolvedValue("sent");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("announcing a course sent for review", () => {
  /* THE RULE THIS FILE EXISTS FOR. An admin submitting is an admin who is
     about to approve — the builder's publish button does both in one press —
     so there is no request pending on anybody, and a group that is told about
     those learns to read «публікація» as something needing no answer. */
  it("says nothing when the submitter is the person who approves", async () => {
    await expect(announceReviewSubmitted({ ...submission, actorIsAdmin: true })).resolves.toBe("skipped_admin");
    expect(notifyHouseThread).not.toHaveBeenCalled();
  });

  it("tells the house when an author is waiting on it", async () => {
    await expect(announceReviewSubmitted({ ...submission, actorIsAdmin: false })).resolves.toBe("sent");
    expect(notifyHouseThread).toHaveBeenCalledTimes(1);
  });

  it("names the course and who is waiting, and marks itself as a publication", () => {
    const text = formatReviewSubmission(submission);
    expect(text.split("\n")[0]).toContain("Публікація");
    expect(text).toContain("Short-Перезавантаження (short)");
    expect(text).toContain("author@example.com");
    expect(text).toContain("/admin/catalog");
  });

  /* Which of the two it is decides what the reader does first: a revision can
     wait an hour because learners are reading a good version meanwhile, and a
     first publication is a course nobody has seen at all. */
  it("separates an update to a live course from a first publication", () => {
    expect(formatReviewSubmission({ ...submission, isRevision: true })).toContain("Учні бачать поточну версію");
    expect(formatReviewSubmission(submission)).toContain("Перша публікація");
  });

  it("leaves out the author line rather than printing an empty one", () => {
    expect(formatReviewSubmission({ ...submission, actorEmail: null })).not.toContain("Автор:");
  });
});
