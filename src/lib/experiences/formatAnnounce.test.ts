import { beforeEach, describe, expect, it, vi } from "vitest";

import { announceFormatProposed, formatProposalNotice } from "./formatAnnounce";

const notifyHouseThread = vi.fn();
vi.mock("@/lib/telegram/houseThread", () => ({
  notifyHouseThread: (...args: unknown[]) => notifyHouseThread(...args),
}));

const proposal = {
  courseSlug: "way21",
  courseTitle: "Шлях 21",
  formatLabel: "У групі потоку",
  proposedAmount: 4100,
  currency: "UAH",
  isPriceChange: false,
};

beforeEach(() => {
  notifyHouseThread.mockReset().mockResolvedValue("sent");
});

describe("announcing a format sent for approval", () => {
  it("says nothing when the person proposing is the person who approves", async () => {
    await expect(announceFormatProposed({ ...proposal, actorIsAdmin: true })).resolves.toBe("skipped_admin");
    expect(notifyHouseThread).not.toHaveBeenCalled();
  });

  it("tells the house when an author is waiting on a price", async () => {
    await expect(announceFormatProposed({ ...proposal, actorIsAdmin: false })).resolves.toBe("sent");
    expect(notifyHouseThread).toHaveBeenCalledTimes(1);
  });

  it("names the course, the format and the price before any link", () => {
    const lines = formatProposalNotice(proposal).split("\n");
    expect(lines[1]).toBe("Шлях 21 (way21) · У групі потоку");
    expect(lines[2]).toBe("Ціна: 4100 грн");
    expect(lines.at(-1)).toContain("/admin/catalog");
  });

  it("says so when no price was given, and when it is a new price for a format on sale", () => {
    expect(formatProposalNotice({ ...proposal, proposedAmount: null })).toContain("Ціну автор не вказав.");
    expect(formatProposalNotice({ ...proposal, isPriceChange: true })).toContain("вже продається");
  });
});
